import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import api from '../../services/api';
import { useToast } from '../../hooks/toast';
import ProviderHeader from '../../components/ProviderHeader';
import { cn } from '../../lib/utils';
import type {
  WeeklyMap,
  OverrideRow,
  ScheduleConfigResponse,
  LocalOverrideValue,
} from '../../utils/providerScheduleEffective';
import {
  DEFAULT_PROVIDER_ALLOWED_HOURS,
  keyFor,
  baseHoursForDate,
  applyOverrides,
} from '../../utils/providerScheduleEffective';

const DEFAULT_ALLOWED_HOURS = DEFAULT_PROVIDER_ALLOWED_HOURS;

function weekdayLabel(dow: number): string {
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return labels[dow] || String(dow);
}

function hourToNumber(time: string): number {
  const [h] = time.split(':').map(Number);
  return Number.isFinite(h) ? h : 0;
}

const ProviderSchedule: React.FC = () => {
  const { addToast } = useToast();
  const closeAfterSaveRef = useRef(false);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weeklyModalOpen, setWeeklyModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [allowedHours, setAllowedHours] = useState<string[]>(DEFAULT_ALLOWED_HOURS);
  const [serverWeekly, setServerWeekly] = useState<WeeklyMap>({});
  const [serverOverrides, setServerOverrides] = useState<Map<string, boolean>>(new Map());

  const [weekly, setWeekly] = useState<WeeklyMap>({});
  const [localOverrides, setLocalOverrides] = useState<Map<string, LocalOverrideValue>>(new Map());

  const fromTo = useMemo(() => {
    const from = format(startOfMonth(month), 'yyyy-MM-dd');
    const to = format(endOfMonth(month), 'yyyy-MM-dd');
    return { from, to };
  }, [month]);

  const selectedYmd = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const hasAnyWeeklyConfigured = useMemo(() => {
    for (let dow = 0; dow <= 6; dow += 1) {
      if ((weekly[String(dow)] || []).length > 0) return true;
    }
    return false;
  }, [weekly]);

  const hasWeeklyChanges = useMemo(() => {
    const keys = new Set([...Object.keys(serverWeekly), ...Object.keys(weekly)]);
    for (const k of Array.from(keys)) {
      const a = (serverWeekly[k] || []).slice().sort().join(',');
      const b = (weekly[k] || []).slice().sort().join(',');
      if (a !== b) return true;
    }
    return false;
  }, [serverWeekly, weekly]);

  const dirty = useMemo(() => hasWeeklyChanges || localOverrides.size > 0, [hasWeeklyChanges, localOverrides]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    api
      .get<ScheduleConfigResponse>('/provider/schedule-config', { params: fromTo })
      .then(res => {
        const data = res.data;
        setAllowedHours(
          Array.isArray(data.allowed_hours) && data.allowed_hours.length > 0
            ? data.allowed_hours
            : DEFAULT_ALLOWED_HOURS,
        );
        setServerWeekly(data.weekly || {});
        setWeekly(data.weekly || {});

        const map = new Map<string, boolean>();
        for (const o of data.overrides || []) {
          map.set(keyFor(o.date_ymd, o.time), o.enabled);
        }
        setServerOverrides(map);
        setLocalOverrides(new Map());
      })
      .catch(() => {
        setLoadError('Não foi possível carregar do servidor. Confirma se estás logada como provider e se a API está online.');
        addToast({
          type: 'error',
          title: 'Erro',
          description: 'Não foi possível carregar a agenda de trabalho.',
        });
      })
      .finally(() => setLoading(false));
  }, [fromTo, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    if (loadError) return;
    if (!hasAnyWeeklyConfigured) {
      setWeeklyModalOpen(true);
    }
  }, [loading, loadError, hasAnyWeeklyConfigured]);

  const effectiveHoursForYmd = useCallback(
    (ymd: string) => {
      const base = baseHoursForDate(weekly, ymd);
      return applyOverrides(base, allowedHours, ymd, serverOverrides, localOverrides);
    },
    [weekly, allowedHours, serverOverrides, localOverrides],
  );

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      days.push(d);
    }
    return days;
  }, [month]);

  const selectedEffective = useMemo(() => effectiveHoursForYmd(selectedYmd), [effectiveHoursForYmd, selectedYmd]);

  const dayWorks = selectedEffective.size > 0;

  const toggleDay = useCallback(() => {
    setLocalOverrides(prev => {
      const next = new Map(prev);
      const k = keyFor(selectedYmd, null);

      if (dayWorks) {
        next.set(k, false);
      } else {
        const base = baseHoursForDate(weekly, selectedYmd);
        if (base.size === 0) next.set(k, true);
        else next.set(k, null);
      }

      return next;
    });
  }, [selectedYmd, dayWorks, weekly]);

  const toggleHour = useCallback(
    (time: string) => {
      if (!dayWorks) return;
      setLocalOverrides(prev => {
        const next = new Map(prev);
        const k = keyFor(selectedYmd, time);
        const base = baseHoursForDate(weekly, selectedYmd);
        const baseHas = base.has(time);
        const effectiveHas = selectedEffective.has(time);

        const nextHas = !effectiveHas;

        if (nextHas === baseHas) {
          next.set(k, null);
        } else {
          next.set(k, nextHas);
        }
        return next;
      });
    },
    [dayWorks, selectedYmd, weekly, selectedEffective],
  );

  const toggleWeekly = useCallback(
    (weekday: number, time: string) => {
      setWeekly(prev => {
        const next: WeeklyMap = { ...prev };
        const k = String(weekday);
        const set = new Set(next[k] || []);
        if (set.has(time)) set.delete(time);
        else set.add(time);
        next[k] = Array.from(set);
        return next;
      });
    },
    [],
  );

  const setWeeklyAll = useCallback(
    (weekday: number) => {
      setWeekly(prev => {
        const next: WeeklyMap = { ...prev };
        next[String(weekday)] = allowedHours.slice();
        return next;
      });
    },
    [allowedHours],
  );

  const setWeeklyNone = useCallback((weekday: number) => {
    setWeekly(prev => {
      const next: WeeklyMap = { ...prev };
      next[String(weekday)] = [];
      return next;
    });
  }, []);

  const setWeeklyPreset = useCallback(
    (weekday: number, preset: 'morning' | 'afternoon' | 'evening') => {
      setWeekly(prev => {
        const next: WeeklyMap = { ...prev };
        const hours = allowedHours.filter(t => {
          const h = hourToNumber(t);
          if (preset === 'morning') return h >= 8 && h <= 12;
          if (preset === 'afternoon') return h >= 13 && h <= 17;
          return h >= 18;
        });
        next[String(weekday)] = hours;
        return next;
      });
    },
    [allowedHours],
  );

  const applyWeekdaysAll = useCallback(() => {
    setWeekly(prev => {
      const next: WeeklyMap = { ...prev };
      for (const dow of [1, 2, 3, 4, 5]) {
        next[String(dow)] = allowedHours.slice();
      }
      return next;
    });
  }, [allowedHours]);

  const resetMonthToWeekly = useCallback(() => {
    setLocalOverrides(prev => {
      const next = new Map(prev);
      for (const d of monthDays) {
        if (!isSameMonth(d, month)) continue;
        const ymd = format(d, 'yyyy-MM-dd');
        next.set(keyFor(ymd, null), null);
        for (const t of allowedHours) {
          next.set(keyFor(ymd, t), null);
        }
      }
      return next;
    });
  }, [monthDays, month, allowedHours]);

  const closeMonthAllDays = useCallback(() => {
    setLocalOverrides(prev => {
      const next = new Map(prev);
      for (const d of monthDays) {
        if (!isSameMonth(d, month)) continue;
        const ymd = format(d, 'yyyy-MM-dd');
        next.set(keyFor(ymd, null), false);
        for (const t of allowedHours) {
          next.set(keyFor(ymd, t), null);
        }
      }
      return next;
    });
  }, [monthDays, month, allowedHours]);

  const resetLocal = useCallback(() => {
    setWeekly(serverWeekly);
    setLocalOverrides(new Map());
  }, [serverWeekly]);

  const save = useCallback(() => {
    if (!dirty) return;
    if (loadError) {
      addToast({
        type: 'error',
        title: 'Não é possível guardar',
        description: 'A agenda não foi carregada corretamente do servidor.',
      });
      return;
    }
    setSaving(true);

    const weeklyPayload = Object.keys({ ...weekly, ...serverWeekly }).map(k => ({
      weekday: Number(k),
      hours: (weekly[k] || []).slice(),
    }));

    const overridesPayload = Array.from(localOverrides.entries()).map(([k, enabled]) => {
      const [dateYmd, rawTime] = k.split('::');
      const time = rawTime === '__day__' ? null : rawTime;
      return { dateYmd, time, enabled };
    });

    api
      .put<ScheduleConfigResponse>('/provider/schedule-config', {
        weekly: weeklyPayload,
        overrides: overridesPayload,
      })
      .then(res => {
        const data = res.data;
        setAllowedHours(data.allowed_hours || []);
        setServerWeekly(data.weekly || {});
        setWeekly(data.weekly || {});

        const map = new Map<string, boolean>();
        for (const o of data.overrides || []) {
          map.set(keyFor(o.date_ymd, o.time), o.enabled);
        }
        setServerOverrides(map);
        setLocalOverrides(new Map());

        addToast({ type: 'success', title: 'Alterações guardadas' });

        if (closeAfterSaveRef.current) {
          setWeeklyModalOpen(false);
        }
      })
      .catch(() => {
        addToast({
          type: 'error',
          title: 'Erro ao guardar',
          description: 'Tenta novamente.',
        });
      })
      .finally(() => {
        closeAfterSaveRef.current = false;
        setSaving(false);
      });
  }, [dirty, weekly, serverWeekly, localOverrides, addToast, loadError]);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <ProviderHeader />

      <main className="mx-auto my-10 max-w-[1120px] px-4 sm:px-6">
        <section className="rounded-[10px] bg-[var(--color-black-medium)] p-6">
          <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[260px]">
              <h1 className="mb-2 text-[28px]">Horários de trabalho</h1>
              <p className="mb-5 text-[var(--color-light-gray)]">
                Ajusta exceções no calendário do mês. O horário padrão é uma configuração geral (no botão).
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setWeeklyModalOpen(true)}
                className="h-10 rounded-[10px] border-0 bg-[var(--color-shape)] px-4 font-bold text-[var(--color-white)] hover:opacity-90"
              >
                Configurar horário padrão
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="mb-3.5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={resetMonthToWeekly}
                className="h-[34px] rounded-[10px] border-0 bg-white/[0.08] px-3 font-bold text-[var(--color-white)] hover:opacity-90"
              >
                Aplicar horário padrão
              </button>
              <button
                type="button"
                onClick={closeMonthAllDays}
                className="h-[34px] rounded-[10px] border-0 bg-white/[0.08] px-3 font-bold text-[var(--color-white)] hover:opacity-90"
              >
                Fechar todos os dias (mês)
              </button>
            </div>
          </div>
          {!loading && !loadError && !hasAnyWeeklyConfigured && (
            <p className="mb-3 font-bold text-[var(--color-primary)]">
              Primeiro define o teu horário padrão no botão “Configurar horário padrão”.
            </p>
          )}

          {loading && <p>A carregar…</p>}
          {!loading && loadError && (
            <p className="mb-4 text-[var(--color-light-gray)]">{loadError}</p>
          )}

          {!loading && (
            <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_420px]">
              <div className="rounded-[10px] bg-[var(--color-shape)] p-3.5">
                <div className="mb-2 grid grid-cols-7 gap-2 text-xs uppercase tracking-wide text-[var(--color-light-gray)]">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {monthDays.map(d => {
                    const muted = !isSameMonth(d, month);
                    const ymd = format(d, 'yyyy-MM-dd');
                    const eff = effectiveHoursForYmd(ymd);
                    const state: 'closed' | 'partial' | 'open' =
                      eff.size === 0 ? 'closed' : eff.size === allowedHours.length ? 'open' : 'partial';
                    const label =
                      state === 'closed'
                        ? 'Fechado'
                        : state === 'open'
                          ? 'Aberto'
                          : `${eff.size}/${allowedHours.length}`;
                    return (
                      <button
                        key={ymd}
                        type="button"
                        className={cn(
                          'flex h-[74px] flex-col items-start justify-between rounded-xl border border-transparent bg-black/20 p-2.5 text-left text-[var(--color-white)]',
                          muted && 'opacity-45',
                          isSameDay(d, selectedDate) && 'border-[var(--color-primary)]',
                          state === 'closed' && 'bg-white/[0.04]',
                          state === 'partial' && 'bg-[rgba(255,210,228,0.12)]',
                          state === 'open' && 'bg-[rgba(255,210,228,0.22)]',
                        )}
                        onClick={() => setSelectedDate(d)}
                      >
                        <strong className="text-base">{format(d, 'd')}</strong>
                        <span className="text-xs text-[var(--color-light-gray)]">{label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMonth(m => subMonths(m, 1))}
                      className="h-10 rounded-[10px] border-0 bg-[var(--color-shape)] px-3.5 text-[var(--color-white)] hover:brightness-110"
                    >
                      Mês anterior
                    </button>
                    <strong>{format(month, 'MMMM yyyy', { locale: pt })}</strong>
                    <button
                      type="button"
                      onClick={() => setMonth(m => addMonths(m, 1))}
                      className="h-10 rounded-[10px] border-0 bg-[var(--color-shape)] px-3.5 text-[var(--color-white)] hover:brightness-110"
                    >
                      Próximo mês
                    </button>
                  </div>
                </div>
              </div>

              <aside className="rounded-[10px] bg-[var(--color-shape)] p-4">
                <h2 className="mb-2.5 text-base">
                  {format(selectedDate, "dd 'de' MMMM", { locale: pt })}
                </h2>

                <div className="mb-3.5 flex items-center justify-between gap-3">
                  <span>{dayWorks ? 'A trabalhar' : 'Não trabalha'}</span>
                  <button
                    type="button"
                    onClick={toggleDay}
                    className={cn(
                      'h-[34px] rounded-[10px] border-0 px-3 font-semibold',
                      dayWorks
                        ? 'bg-[var(--color-primary)] text-[var(--color-background)]'
                        : 'bg-white/10 text-[var(--color-white)]',
                    )}
                  >
                    {dayWorks ? 'Desativar dia' : 'Ativar dia'}
                  </button>
                </div>

                <h2 className="mb-2.5 text-base">Horas</h2>
                {!dayWorks && (
                  <p className="mb-2.5 text-[var(--color-light-gray)]">Ativa o dia para escolher horas.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {allowedHours.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={cn(
                        'h-[34px] rounded-full border border-white/10 bg-black/20 px-3 font-semibold text-[var(--color-white)]',
                        selectedEffective.has(t) &&
                          'border-[var(--color-primary)] bg-[rgba(255,210,228,0.22)]',
                        !dayWorks && 'cursor-not-allowed opacity-45',
                      )}
                      onClick={() => toggleHour(t)}
                      disabled={!dayWorks}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          )}

          <div className="mt-[18px] flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.08] pt-3.5">
            <span
              className={cn(
                'font-semibold text-[var(--color-light-gray)]',
                dirty && 'text-[var(--color-primary)]',
              )}
            >
              {dirty ? 'Alterações pendentes' : 'Sem alterações'}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={resetLocal}
                className="h-10 rounded-[10px] border-0 bg-[var(--color-shape)] px-4 font-semibold text-[var(--color-white)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Repor
              </button>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={save}
                className="h-10 rounded-[10px] border-0 bg-[var(--color-primary)] px-4 font-semibold text-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'A guardar…' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {weeklyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4"
          onClick={() => setWeeklyModalOpen(false)}
        >
          <div
            className="max-h-[calc(100vh-32px)] w-full max-w-[1040px] overflow-auto rounded-[14px] border border-white/[0.08] bg-[var(--color-black-medium)] p-[18px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-[2] -mx-[18px] mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[var(--color-black-medium)] px-[18px] pb-2.5 pt-2.5">
              <strong className="text-lg">Horário padrão (configuração geral)</strong>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setWeeklyModalOpen(false)}
                  className="h-9 cursor-pointer rounded-[10px] border-0 bg-white/[0.08] px-3.5 font-bold text-[var(--color-white)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  disabled={!dirty || saving || !!loadError}
                  onClick={() => {
                    closeAfterSaveRef.current = true;
                    save();
                  }}
                  className="h-9 cursor-pointer rounded-[10px] border-0 bg-[var(--color-primary)] px-3.5 font-bold text-[var(--color-background)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'A guardar…' : 'Salvar e fechar'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 py-3 pb-3.5">
              <p className="m-0 text-[var(--color-light-gray)]">
                Dica: usa “Todas” e depois desmarca só as que não queres.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={applyWeekdaysAll}
                  className="h-8 rounded-full border-0 bg-white/[0.08] px-3 font-extrabold text-[var(--color-white)] hover:opacity-90"
                >
                  Dias úteis: todas
                </button>
              </div>
            </div>

            <div className="m-0 border-0 p-0">
              {Array.from({ length: 7 }).map((_, dow) => (
                <div key={String(dow)} className="mb-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <span className="font-bold text-[var(--color-light-gray)]">
                      {weekdayLabel(dow)}{' '}
                      <span className="font-bold text-[var(--color-light-gray)]">
                        ({(weekly[String(dow)] || []).length}/{allowedHours.length})
                      </span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setWeeklyAll(dow)}
                        className="h-7 rounded-full border-0 bg-white/[0.08] px-2.5 font-bold text-[var(--color-white)] hover:opacity-90"
                      >
                        Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeeklyNone(dow)}
                        className="h-7 rounded-full border-0 bg-white/[0.08] px-2.5 font-bold text-[var(--color-white)] hover:opacity-90"
                      >
                        Nenhuma
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeeklyPreset(dow, 'morning')}
                        className="h-7 rounded-full border-0 bg-white/[0.08] px-2.5 font-bold text-[var(--color-white)] hover:opacity-90"
                      >
                        Manhã
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeeklyPreset(dow, 'afternoon')}
                        className="h-7 rounded-full border-0 bg-white/[0.08] px-2.5 font-bold text-[var(--color-white)] hover:opacity-90"
                      >
                        Tarde
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeeklyPreset(dow, 'evening')}
                        className="h-7 rounded-full border-0 bg-white/[0.08] px-2.5 font-bold text-[var(--color-white)] hover:opacity-90"
                      >
                        Noite
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-[90px_1fr] items-center gap-3 py-2">
                    <span className="invisible font-semibold text-[var(--color-light-gray)]">x</span>
                    <div className="flex flex-wrap gap-2">
                      {allowedHours.map(t => (
                        <button
                          key={`${dow}-${t}`}
                          type="button"
                          className={cn(
                            'h-[34px] rounded-full border border-white/10 bg-black/20 px-3 font-semibold text-[var(--color-white)]',
                            (weekly[String(dow)] || []).includes(t) &&
                              'border-[var(--color-primary)] bg-[rgba(255,210,228,0.22)]',
                          )}
                          onClick={() => toggleWeekly(dow, t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderSchedule;

