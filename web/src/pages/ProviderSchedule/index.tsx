import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import api from '../../services/api';
import { useToast } from '../../hooks/toast';
import ProviderHeader from '../../components/ProviderHeader';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
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

/** Page buttons: consistent height / touch target; paired `flex-1` in the modal. */
const BTN =
  'inline-flex h-10 min-h-[2.5rem] shrink-0 appearance-none items-center justify-center gap-1.5 rounded-[10px] border-0 px-4 text-sm font-semibold leading-none transition-opacity disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PILL =
  'inline-flex h-10 min-h-[2.5rem] appearance-none items-center justify-center rounded-full border-0 px-3.5 text-sm font-bold leading-none transition-opacity disabled:cursor-not-allowed disabled:opacity-50';
const BTN_ICON_SQ =
  'inline-flex h-10 w-10 min-h-[2.5rem] min-w-[2.5rem] shrink-0 appearance-none items-center justify-center rounded-[10px] border-0 text-[var(--color-text-white)] transition-[filter] disabled:cursor-not-allowed disabled:opacity-50';

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
        setLoadError('Não foi possível carregar do servidor. Confirma que tens sessão iniciada como profissional e que a API está online.');
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
        <section className="rounded-[10px] bg-[var(--color-black-medium)] p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-[260px] pr-1">
              <h1 className="mb-2 text-[28px] text-[var(--color-text-white)]">Horários de trabalho</h1>
              <p className="mb-1 text-[var(--color-light-gray)]">
                Ajusta exceções no calendário do mês.
              </p>
            </div>

            <div className="flex w-full min-w-0 shrink-0 sm:w-auto sm:justify-end">
              <button
                type="button"
                onClick={() => setWeeklyModalOpen(true)}
                className={cn(BTN, 'w-full flex-1 bg-[var(--color-shape)] font-bold text-[var(--color-text-white)] hover:opacity-90 sm:w-auto sm:flex-none')}
              >
                Configurar horário padrão
              </button>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap gap-2.5">
              <button
                type="button"
                onClick={resetMonthToWeekly}
                className={cn(
                  BTN,
                  'w-full md:w-auto border border-[var(--color-input-border)] bg-[var(--color-white)] font-bold text-[var(--color-text-white)] hover:bg-[var(--color-inputs)]',
                )}
              >
                Aplicar horário padrão
              </button>
              <button
                type="button"
                onClick={closeMonthAllDays}
                className={cn(
                  BTN,
                  'w-full md:w-auto border border-[var(--color-input-border)] bg-[var(--color-white)] font-bold text-[var(--color-text-white)] hover:bg-[var(--color-inputs)]',
                )}
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
            <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-[1fr_420px] lg:gap-7">
              <div className="min-w-0 rounded-[10px] bg-[var(--color-shape)] p-4 sm:p-5">
                <div className="mb-2.5 grid min-w-0 grid-cols-7 gap-x-2 gap-y-1 text-[10px] uppercase tracking-wide text-[var(--color-light-gray)] sm:gap-x-2.5 sm:text-xs">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                    <div key={d} className="min-w-0 truncate text-center">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid min-w-0 auto-rows-fr grid-cols-7 gap-x-2 gap-y-2.5 sm:gap-x-2.5 sm:gap-y-3">
                  {monthDays.map(d => {
                    const muted = !isSameMonth(d, month);
                    const ymd = format(d, 'yyyy-MM-dd');
                    const eff = effectiveHoursForYmd(ymd);
                    const state: 'closed' | 'partial' | 'open' =
                      eff.size === 0 ? 'closed' : eff.size === allowedHours.length ? 'open' : 'partial';
                    const labelShort =
                      state === 'closed'
                        ? '—'
                        : state === 'open'
                          ? '✓'
                          : `${eff.size}/${allowedHours.length}`;
                    const labelFull =
                      state === 'closed'
                        ? 'Fechado'
                        : state === 'open'
                          ? 'Aberto'
                          : `${eff.size} de ${allowedHours.length} horas`;
                    return (
                      <button
                        key={ymd}
                        type="button"
                        className={cn(
                          'flex min-h-[5.5rem] min-w-0 w-full flex-col items-stretch justify-start gap-1.5 overflow-hidden rounded-lg border border-[var(--color-input-border)] bg-[var(--color-white)] px-2 py-2 text-left text-[var(--color-text-white)] sm:min-h-[5.75rem] sm:rounded-xl sm:px-2.5 sm:py-2.5',
                          muted && 'opacity-45',
                          isSameDay(d, selectedDate) && 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-shape)]',
                          state === 'closed' && 'bg-[var(--color-disabled-bg)]',
                          state === 'partial' && 'bg-[#e4cdb0]',
                          state === 'open' && 'bg-[#d8b896]',
                        )}
                        onClick={() => setSelectedDate(d)}
                      >
                        <strong className="shrink-0 text-[15px] font-bold leading-none tabular-nums sm:text-base">
                          {format(d, 'd')}
                        </strong>
                        <span
                          className="block min-h-[1.125rem] min-w-0 truncate text-center text-[11px] font-semibold leading-none text-[var(--color-primary-darken)] sm:text-xs"
                          title={labelFull}
                          aria-label={labelFull}
                        >
                          {labelShort}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-input-border)] pt-4">
                  <button
                    type="button"
                    onClick={() => setMonth(m => subMonths(m, 1))}
                    className={cn(BTN_ICON_SQ, 'bg-[var(--color-shape)] hover:brightness-110')}
                    aria-label="Mês anterior"
                    title="Mês anterior"
                  >
                    <FiChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                  <strong className="min-w-0 flex-1 truncate px-1 text-center text-sm capitalize text-[var(--color-text-white)] sm:text-base">
                    {format(month, 'MMMM yyyy', { locale: pt })}
                  </strong>
                  <button
                    type="button"
                    onClick={() => setMonth(m => addMonths(m, 1))}
                    className={cn(BTN_ICON_SQ, 'bg-[var(--color-shape)] hover:brightness-110')}
                    aria-label="Próximo mês"
                    title="Próximo mês"
                  >
                    <FiChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>

              <aside className="rounded-[10px] bg-[var(--color-shape)] p-5 sm:p-6">
                <h2 className="mb-3 text-base text-[var(--color-text-white)]">
                  {format(selectedDate, "dd 'de' MMMM", { locale: pt })}
                </h2>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0 pr-1 text-[var(--color-text-white)]">{dayWorks ? 'A trabalhar' : 'Não trabalha'}</span>
                  <button
                    type="button"
                    onClick={toggleDay}
                    className={cn(
                      BTN,
                      'min-w-0 flex-1 sm:flex-none sm:px-6',
                      dayWorks
                        ? 'bg-[var(--color-primary)] text-[var(--color-header-text)]'
                        : 'border border-[var(--color-input-border)] bg-[var(--color-white)] text-[var(--color-text-white)] hover:bg-[var(--color-inputs)]',
                    )}
                  >
                    {dayWorks ? 'Desativar dia' : 'Ativar dia'}
                  </button>
                </div>

                <h2 className="mb-3 text-base text-[var(--color-text-white)]">Horas</h2>
                {!dayWorks && (
                  <p className="mb-3 text-[var(--color-light-gray)]">Ativa o dia para escolher horas.</p>
                )}
                <div className="flex flex-wrap gap-2.5">
                  {allowedHours.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={cn(
                        BTN_PILL,
                        'min-w-[3.25rem] border border-[var(--color-input-border)] bg-[var(--color-white)] font-semibold text-[var(--color-text-white)]',
                        selectedEffective.has(t) &&
                          'border-[var(--color-primary)] bg-[var(--color-warm-light)] text-[var(--color-primary-darken)]',
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

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-input-border)] pt-5">
            <span
              className={cn(
                'w-full py-0.5 text-center text-sm font-semibold text-[var(--color-light-gray)] sm:w-auto sm:py-0 sm:text-left',
                dirty && 'text-[var(--color-primary)]',
              )}
            >
              {dirty ? 'Alterações pendentes' : 'Sem alterações'}
            </span>
            <div className="flex w-full min-w-0 flex-wrap gap-2.5 sm:w-auto sm:justify-end">
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={resetLocal}
                className={cn(BTN, 'flex-1 bg-[var(--color-shape)] text-[var(--color-text-white)] sm:flex-none sm:min-w-[7.5rem]')}
              >
                Repor
              </button>
              <button
                type="button"
                disabled={!dirty || saving}
                onClick={save}
                className={cn(
                  BTN,
                  'flex-1 bg-[var(--color-primary)] text-[var(--color-background)] sm:flex-none sm:min-w-[10rem]',
                )}
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
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm sm:p-5"
          onClick={() => setWeeklyModalOpen(false)}
        >
          <div
            className="flex max-h-[calc(100vh-32px)] w-full max-w-[1040px] flex-col overflow-hidden rounded-[14px] border border-[var(--color-input-border)] bg-[var(--color-white)] shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-[var(--color-input-border)] px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <strong className="min-w-0 text-lg leading-snug text-[var(--color-text-white)] sm:pr-3">
                  Horário padrão (configuração geral)
                </strong>
                <div className="flex min-w-0 w-full gap-2.5 sm:max-w-md sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setWeeklyModalOpen(false)}
                    className={cn(
                      BTN,
                      'flex-1 border border-[var(--color-input-border)] bg-[var(--color-inputs)] font-bold text-[var(--color-text-white)] hover:bg-[var(--color-disabled-bg)]',
                    )}
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
                    className={cn(
                      BTN,
                      'flex-1 bg-[var(--color-primary)] font-bold text-[var(--color-header-text)] hover:opacity-90',
                    )}
                  >
                    {saving ? 'A guardar…' : 'Salvar e fechar'}
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <p className="m-0 min-w-0 flex-1 text-[var(--color-light-gray)] leading-relaxed">
                  Dica: usa “Todas” e depois desmarca só as que não queres.
                </p>
                <button
                  type="button"
                  onClick={applyWeekdaysAll}
                  className={cn(
                    BTN,
                    'w-full shrink-0 border border-[var(--color-input-border)] bg-[var(--color-inputs)] font-extrabold text-[var(--color-text-white)] hover:bg-[var(--color-disabled-bg)] sm:w-auto sm:min-w-[12rem]',
                  )}
                >
                  Dias úteis: todas
                </button>
              </div>

              <div className="m-0 space-y-4 border-0 p-0">
              {Array.from({ length: 7 }).map((_, dow) => (
                <div key={String(dow)} className="rounded-lg border border-[var(--color-input-border)] bg-[var(--color-inputs)] p-3.5 sm:p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <span className="min-w-0 shrink-0 font-bold text-[var(--color-text-white)]">
                      {weekdayLabel(dow)}{' '}
                      <span className="font-bold text-[var(--color-hard-gray)]">
                        ({(weekly[String(dow)] || []).length}/{allowedHours.length})
                      </span>
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setWeeklyAll(dow)}
                        className={cn(
                          BTN_PILL,
                          'flex-1 border border-[var(--color-input-border)] bg-[var(--color-white)] text-[var(--color-text-white)] hover:bg-[var(--color-disabled-bg)] sm:flex-none',
                        )}
                      >
                        Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeeklyNone(dow)}
                        className={cn(
                          BTN_PILL,
                          'flex-1 border border-[var(--color-input-border)] bg-[var(--color-white)] text-[var(--color-text-white)] hover:bg-[var(--color-disabled-bg)] sm:flex-none',
                        )}
                      >
                        Nenhuma
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeeklyPreset(dow, 'morning')}
                        className={cn(
                          BTN_PILL,
                          'flex-1 border border-[var(--color-input-border)] bg-[var(--color-white)] text-[var(--color-text-white)] hover:bg-[var(--color-disabled-bg)] sm:flex-none',
                        )}
                      >
                        Manhã
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeeklyPreset(dow, 'afternoon')}
                        className={cn(
                          BTN_PILL,
                          'flex-1 border border-[var(--color-input-border)] bg-[var(--color-white)] text-[var(--color-text-white)] hover:bg-[var(--color-disabled-bg)] sm:flex-none',
                        )}
                      >
                        Tarde
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeeklyPreset(dow, 'evening')}
                        className={cn(
                          BTN_PILL,
                          'flex-1 border border-[var(--color-input-border)] bg-[var(--color-white)] text-[var(--color-text-white)] hover:bg-[var(--color-disabled-bg)] sm:flex-none',
                        )}
                      >
                        Noite
                      </button>
                    </div>
                  </div>
                  <div className="pt-0.5">
                    <div className="flex flex-wrap gap-2.5">
                      {allowedHours.map(t => (
                        <button
                          key={`${dow}-${t}`}
                          type="button"
                          className={cn(
                            BTN_PILL,
                            'min-w-[3.25rem] border border-[var(--color-input-border)] bg-[var(--color-white)] font-semibold text-[var(--color-text-white)]',
                            (weekly[String(dow)] || []).includes(t) &&
                              'border-[var(--color-primary)] bg-[var(--color-warm-light)] text-[var(--color-primary-darken)]',
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
        </div>
      )}
    </div>
  );
};

export default ProviderSchedule;

