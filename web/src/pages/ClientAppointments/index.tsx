import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { format, parseISO, isBefore } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FiArrowLeft } from 'react-icons/fi';

import api from '../../services/api';
import Avatar from '../../components/Avatar';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';

interface MeAppointment {
  id: number;
  date: string;
  past?: boolean;
  cancelable?: boolean;
  status?: 'scheduled' | 'attended' | 'canceled' | 'no_show';
  canceled_at?: string | null;
  service: { id: number; name: string } | null;
  provider: {
    id: number;
    name: string;
    avatar: { url: string } | null;
  };
}

function statusLabel(status?: MeAppointment['status']): string | null {
  if (!status) return null;
  if (status === 'scheduled') return 'Marcado';
  if (status === 'attended') return 'Atendido';
  if (status === 'no_show') return 'Ausente';
  return 'Cancelado';
}

function isPastAppointment(a: MeAppointment): boolean {
  if (typeof a.past === 'boolean') {
    return a.past;
  }
  return isBefore(parseISO(String(a.date)), new Date());
}

const ClientAppointments: React.FC = () => {
  const history = useHistory();
  const [rows, setRows] = useState<MeAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCancelId, setPendingCancelId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<MeAppointment[]>('/appointments/me?page=1', { timeout: 15000 })
      .then(res => {
        if (cancelled) return;
        setRows(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { upcoming, past } = useMemo(() => {
    const u: MeAppointment[] = [];
    const p: MeAppointment[] = [];
    for (const a of rows) {
      if (isPastAppointment(a)) {
        p.push(a);
      } else {
        u.push(a);
      }
    }
    u.sort(
      (a, b) =>
        +parseISO(String(a.date)) - +parseISO(String(b.date)),
    );
    p.sort(
      (a, b) =>
        +parseISO(String(b.date)) - +parseISO(String(a.date)),
    );
    return { upcoming: u, past: p };
  }, [rows]);

  const formatWhen = (iso: string) =>
    format(parseISO(String(iso)), "EEEE, d 'de' MMMM · HH:mm", {
      locale: pt,
    });

  const confirmCancel = useCallback(async (id: number) => {
    try {
      await api.delete(`/appointments/${id}`);
      setRows(prev =>
        prev.map(p =>
          p.id === id
            ? {
                ...p,
                status: 'canceled',
                canceled_at: new Date().toISOString(),
              }
            : p,
        ),
      );
    } catch {
    } finally {
      setPendingCancelId(null);
    }
  }, []);

  const goToReschedule = useCallback(
    (a: MeAppointment) => {
      history.push(`/client/reschedule/${a.id}`, {
        providerId: a.provider.id,
        serviceId: a.service?.id,
        serviceName: a.service?.name,
      });
    },
    [history],
  );

  const linkBtn =
    'cursor-pointer border-0 bg-transparent p-0 text-sm text-[var(--color-primary)] hover:underline';

  return (
    <div className="mx-auto min-h-screen max-w-[720px] px-6 pb-20 pt-12">
      <header className="mb-8">
        <Link
          to="/client"
          className="mb-4 inline-flex items-center gap-2 text-[var(--color-primary)] no-underline"
        >
          <FiArrowLeft />
          Voltar
        </Link>
        <h1 className="text-[26px]">Minhas marcações</h1>
      </header>
      {loading && <p>A carregar…</p>}
      {!loading && rows.length === 0 && <p>Ainda não tem marcações.</p>}

      {!loading && upcoming.length > 0 && (
        <>
          <h2 className="mb-3 mt-0 text-lg font-semibold text-[var(--color-light-gray)] first:mt-0">
            Próximas
          </h2>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {upcoming.map(a => (
              <li
                key={a.id}
                className="flex gap-4 rounded-[10px] bg-[var(--color-black-medium)] p-5"
              >
                <Avatar
                  name={a.provider.name}
                  src={a.provider.avatar?.url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <strong className="mb-2 block text-[17px]">
                    {a.service?.name ?? 'Serviço'}
                  </strong>
                  <span className="mb-1.5 block text-[15px] text-[var(--color-white)]">
                    {a.provider.name}
                  </span>
                  <span className="mb-1 block text-sm leading-snug text-[var(--color-light-gray)]">
                    {formatWhen(String(a.date))}
                  </span>
                  {a.status && (
                    <Badge variant={a.status} className="mt-1.5">
                      Status: {statusLabel(a.status)}
                    </Badge>
                  )}
                  {a.status === 'scheduled' && a.cancelable && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {pendingCancelId === a.id ? (
                        <span className="inline-flex flex-wrap items-center gap-2 text-sm text-[var(--color-light-gray)]">
                          Cancelar esta marcação?
                          <button
                            type="button"
                            className={`${linkBtn} text-[var(--color-error)]`}
                            onClick={() => confirmCancel(a.id)}
                          >
                            Sim, cancelar
                          </button>
                          <button
                            type="button"
                            className={linkBtn}
                            onClick={() => setPendingCancelId(null)}
                          >
                            Manter
                          </button>
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={linkBtn}
                            onClick={() => setPendingCancelId(a.id)}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className={linkBtn}
                            onClick={() => goToReschedule(a)}
                          >
                            Remarcar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {!loading && past.length > 0 && (
        <>
          <h2 className="mb-3 mt-7 text-lg font-semibold text-[var(--color-light-gray)]">
            Passadas
          </h2>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {past.map(a => (
              <li
                key={a.id}
                className={cn(
                  'flex gap-4 rounded-[10px] border border-[var(--color-hard-gray)] p-5 opacity-80',
                  'bg-[var(--color-shape)] grayscale-[35%]',
                )}
              >
                <Avatar
                  name={a.provider.name}
                  src={a.provider.avatar?.url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <strong className="mb-2 block text-[17px]">
                    {a.service?.name ?? 'Serviço'}
                  </strong>
                  <span className="mb-1.5 block text-[15px] text-[var(--color-white)]">
                    {a.provider.name}
                  </span>
                  <span className="mb-1 block text-sm leading-snug text-[var(--color-light-gray)]">
                    {formatWhen(String(a.date))}
                  </span>
                  {a.status && (
                    <Badge variant={a.status} className="mt-1.5">
                      Status: {statusLabel(a.status)}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default ClientAppointments;
