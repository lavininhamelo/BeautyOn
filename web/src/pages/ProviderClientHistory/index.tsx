import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FiArrowLeft } from 'react-icons/fi';

import api from '../../services/api';
import ProviderHeader from '../../components/ProviderHeader';

type AppointmentStatus = 'scheduled' | 'attended' | 'canceled' | 'no_show' | string;

type HistoryRow = {
  id: number;
  date: string;
  status: AppointmentStatus;
  service: { id: number; name: string } | null;
  canceled_at: string | null;
  client: { name: string | null; phone: string | null; is_guest: boolean };
};

function statusLabel(status: AppointmentStatus): string {
  if (status === 'scheduled') return 'Marcado';
  if (status === 'attended') return 'Atendido';
  if (status === 'no_show') return 'Ausente';
  if (status === 'canceled') return 'Cancelado';
  return String(status);
}

const ProviderClientHistory: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const id = Number(clientId);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HistoryRow[]>([]);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<HistoryRow[]>(`/provider/clients/${id}/appointments`, { timeout: 15000 })
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
  }, [id]);

  const headerName = useMemo(() => rows[0]?.client?.name ?? 'Cliente', [rows]);

  const formatWhen = (iso: string) =>
    format(parseISO(String(iso)), "EEEE, d 'de' MMMM yyyy · HH:mm", { locale: pt });

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <ProviderHeader />

      <main className="mx-auto max-w-[760px] px-6 pb-20 pt-12">
        <header>
          <Link
            to="/provider/clients"
            className="mb-3.5 inline-flex items-center gap-2.5 font-bold text-[var(--color-primary)] no-underline"
          >
            <FiArrowLeft />
            Voltar
          </Link>
        </header>

        <section className="rounded-[10px] bg-[var(--color-black-medium)] p-6">
          <h1 className="mb-2 text-[28px]">Atendimentos</h1>
          <p className="mb-[18px] text-[var(--color-light-gray)]">
            Marcações/atendimentos de {headerName} (com status).
          </p>

          {!Number.isFinite(id) && <p>ID inválido.</p>}
          {loading && <p>A carregar…</p>}
          {!loading && rows.length === 0 && <p>Sem histórico para este cliente.</p>}

          {!loading && rows.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {rows.map(r => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] bg-[var(--color-shape)] p-4"
                >
                  <div className="min-w-[260px] flex-1">
                    <strong className="mb-1 block">{r.service?.name ?? 'Serviço'}</strong>
                    <span className="mb-0 block text-sm text-[var(--color-light-gray)]">
                      {formatWhen(r.date)}
                    </span>
                    <span className="mt-2.5 inline-flex rounded-full border border-[var(--color-input-border)] bg-[var(--color-white)]/90 px-2.5 py-1.5 text-xs text-[var(--color-text-white)]">
                      Status: {statusLabel(r.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/provider/appointments/${r.id}/record`}
                      className="rounded-lg border-0 bg-transparent px-3 py-2 text-sm text-[var(--color-primary)] no-underline hover:bg-[var(--color-primary)]/10"
                    >
                      Abrir registo
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

export default ProviderClientHistory;
