import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isBefore } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FiPower } from 'react-icons/fi';

import logoImg from '../../assets/images/logo.png';
import { useAuth } from '../../hooks/auth';
import ProviderPicker from '../../components/ProviderPicker';
import BookingWizard from '../../components/BookingWizard';
import { Modal } from '../../components/ui/modal';
import api from '../../services/api';
import Avatar from '../../components/Avatar';
import { Badge } from '../../components/ui/badge';

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

const UPCOMING_PREVIEW = 5;

const ClientHome: React.FC = () => {
  const { user, signOut } = useAuth();
  const [rows, setRows] = useState<MeAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [bookModalProviderId, setBookModalProviderId] = useState<number | null>(null);

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
        if (!cancelled) setLoadingAppointments(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingPreview = useMemo(() => {
    const u: MeAppointment[] = [];
    for (const a of rows) {
      if (!isPastAppointment(a)) u.push(a);
    }
    u.sort(
      (a, b) => +parseISO(String(a.date)) - +parseISO(String(b.date)),
    );
    return u.slice(0, UPCOMING_PREVIEW);
  }, [rows]);

  const formatWhen = (iso: string) =>
    format(parseISO(String(iso)), "EEEE, d 'de' MMMM · HH:mm", {
      locale: pt,
    });

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[var(--color-black-medium)] px-8 py-6">
        <img
          src={logoImg}
          alt="BeautyOn"
          className="h-[72px] w-auto max-w-[200px] shrink-0 object-contain sm:h-[80px] sm:max-w-[220px]"
        />
        <nav className="flex items-center gap-6">
          <Link
            to="/client#marcar"
            className="text-[var(--color-light-gray)] no-underline hover:text-[var(--color-primary)]"
          >
            Marcar
          </Link>
          <Link
            to="/client/appointments"
            className="text-[var(--color-light-gray)] no-underline hover:text-[var(--color-primary)]"
          >
            Minhas marcações
          </Link>
          <Link
            to="/profile"
            className="text-[var(--color-light-gray)] no-underline hover:text-[var(--color-primary)]"
          >
            Perfil
          </Link>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sair"
            className="ml-2 border-0 bg-transparent"
          >
            <FiPower className="h-[22px] w-[22px] text-[var(--color-light-gray)] hover:text-[var(--color-primary)]" />
          </button>
        </nav>
      </header>
      <div className="mx-auto max-w-[1120px] px-6 pb-20 pt-8">
        <section aria-labelledby="upcoming-heading">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="upcoming-heading" className="m-0 text-xl font-semibold text-[var(--color-white)]">
              Próximas marcações
            </h2>
            <Link
              to="/client/appointments"
              className="text-sm text-[var(--color-primary)] no-underline hover:underline"
            >
              Ver todas
            </Link>
          </div>
          {loadingAppointments && <p>A carregar…</p>}
          {!loadingAppointments && upcomingPreview.length === 0 && (
            <p className="text-[var(--color-light-gray)]">
              Ainda não tens marcações futuras. Marca abaixo com um profissional.
            </p>
          )}
          {!loadingAppointments && upcomingPreview.length > 0 && (
            <ul className="m-0 mb-12 flex list-none flex-col gap-4 p-0">
              {upcomingPreview.map(a => (
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="marcar" aria-labelledby="book-heading" className="scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="book-heading" className="m-0 text-xl font-semibold text-[var(--color-white)]">
              Marcar
            </h2>
          </div>
          <ProviderPicker
            bookPath={id => `/client/book/${id}`}
            onSelectProvider={id => setBookModalProviderId(id)}
            title={`Olá, ${user.name}`}
            hideBack
          />
        </section>
      </div>

      <Modal
        open={bookModalProviderId !== null}
        onClose={() => setBookModalProviderId(null)}
        hideChrome
        panelClassName="w-full max-w-2xl sm:max-w-4xl"
      >
        {bookModalProviderId !== null && (
          <BookingWizard
            providerId={bookModalProviderId}
            guestMode={false}
            presentation="modal"
            onRequestClose={() => setBookModalProviderId(null)}
            hideProviderSwitcher
          />
        )}
      </Modal>
    </div>
  );
};

export default ClientHome;
