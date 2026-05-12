import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FiArrowLeft } from 'react-icons/fi';

import api from '../../services/api';
import ProviderHeader from '../../components/ProviderHeader';
import { PhotoLightboxModal } from '../../components/PhotoLightboxModal';
import type { PhotoLightboxSlide } from '../../components/PhotoLightboxModal';

type AppointmentStatus = 'scheduled' | 'attended' | 'canceled' | 'no_show' | string;

type TimelinePhoto = {
  id: number;
  caption: string | null;
  file: { id: number; name: string; path: string; url: string };
};

type TimelineItem = {
  appointment: {
    id: number;
    date: string;
    status: AppointmentStatus;
    service: { id: number; name: string } | null;
  };
  record: null | {
    id: number;
    recorded_at: string;
    summary: string | null;
    notes: string;
    photos: TimelinePhoto[];
  };
};

type TimelineResponse = {
  client: { id: number; name: string; phone: string; email: string | null; created_at: string };
  items: TimelineItem[];
};

function statusLabel(status: AppointmentStatus): string {
  if (status === 'scheduled') return 'Marcado';
  if (status === 'attended') return 'Atendido';
  if (status === 'no_show') return 'Ausente';
  if (status === 'canceled') return 'Cancelado';
  return String(status);
}

const ProviderClientTimeline: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const id = Number(clientId);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [lightbox, setLightbox] = useState<{
    slides: PhotoLightboxSlide[];
    index: number;
  } | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<TimelineResponse>(`/provider/clients/${id}/timeline`, { timeout: 15000 })
      .then(res => {
        if (cancelled) return;
        setData(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const clientName = useMemo(() => data?.client?.name ?? 'Cliente', [data]);

  const when = (iso: string) =>
    format(parseISO(String(iso)), "d 'de' MMMM yyyy · HH:mm", { locale: pt });

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <ProviderHeader />

      <main className="mx-auto max-w-[920px] px-6 pb-20 pt-12">
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
          <h1 className="mb-2 text-[28px] text-[var(--color-text-white)]">Histórico</h1>
          <p className="mb-[18px] text-[var(--color-light-gray)]">
            Linha do tempo do cliente {clientName}: atendimento + texto + fotos.
          </p>

          {!Number.isFinite(id) && <p>ID inválido.</p>}
          {loading && <p>A carregar…</p>}
          {!loading && items.length === 0 && (
            <p className="text-[var(--color-light-gray)]">Sem histórico para este cliente.</p>
          )}

          {!loading && (
            <div className="mt-4 space-y-3">
              {items.map(it => (
              <section
                key={it.appointment.id}
                className="rounded-[10px] bg-[var(--color-shape)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong>{it.appointment.service?.name ?? 'Serviço'}</strong>
                    <div className="mt-1 text-[13px] text-[var(--color-light-gray)]">
                      Atendimento: {when(it.appointment.date)}
                    </div>
                    <span className="mt-2.5 inline-flex rounded-full border border-[var(--color-input-border)] bg-[var(--color-white)]/90 px-2.5 py-1.5 text-xs text-[var(--color-text-white)]">
                      Status: {statusLabel(it.appointment.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/provider/appointments/${it.appointment.id}/record`}
                      className="rounded-lg border-0 bg-transparent px-3 py-2 text-sm text-[var(--color-primary)] no-underline hover:bg-[var(--color-primary)]/10"
                    >
                      {it.record ? 'Editar registo' : 'Criar registo'}
                    </Link>
                  </div>
                </div>

                {it.record ? (
                  <>
                    {!!it.record.summary && (
                      <p className="mt-2.5 font-bold text-[var(--color-text-white)]">{it.record.summary}</p>
                    )}
                    <pre className="mt-2.5 whitespace-pre-wrap font-[inherit] text-[var(--color-light-gray)]">
                      {it.record.notes}
                    </pre>

                    {Array.isArray(it.record.photos) && it.record.photos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2.5">
                        {it.record.photos.map((p, photoIdx) => (
                          <button
                            key={p.id}
                            type="button"
                            className="inline-flex h-[88px] w-[88px] cursor-pointer items-center justify-center overflow-hidden rounded-[10px] border border-[var(--color-input-border)] bg-[var(--color-white)] p-0 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                            onClick={() =>
                              setLightbox({
                                slides: it.record!.photos.map(ph => ({
                                  url: ph.file.url,
                                  alt: ph.file.name,
                                  caption: ph.caption,
                                })),
                                index: photoIdx,
                              })
                            }
                            aria-label={`Abrir imagem ${photoIdx + 1} de ${it.record!.photos.length} em ecrã completo`}
                          >
                            <img
                              className="pointer-events-none block h-full w-full object-cover"
                              src={p.file.url}
                              alt={p.caption ?? p.file.name}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-2.5 text-[13px] text-[var(--color-light-gray)]">
                    Ainda não há registo (texto/fotos) para este atendimento.
                  </div>
                )}
              </section>
              ))}
            </div>
          )}
        </section>
      </main>

      {lightbox && (
        <PhotoLightboxModal
          open
          slides={lightbox.slides}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
};

export default ProviderClientTimeline;
