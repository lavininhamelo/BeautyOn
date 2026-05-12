import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { format, parseISO, isBefore } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FiLogOut, FiMenu, FiX } from 'react-icons/fi';

import logoImg from '../../assets/images/logo_white.webp';
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<MeAppointment[]>('/appointments/me?page=1', { timeout: 15000 })
      .then(res => {
        if (!cancelled) setRows(Array.isArray(res.data) ? res.data : []);
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

  const closeMenu = () => setMenuOpen(false);
  const navLinkClass =
    'text-[var(--color-header-link-muted)] no-underline hover:text-[var(--color-warm-light)]';

  const mobileMenuLayer =
    menuOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm md:hidden"
          aria-label="Fechar menu"
          onClick={closeMenu}
        />
        <div
          id="client-mobile-nav"
          className="fixed right-0 top-0 z-[1010] flex h-full w-[min(20rem,88vw)] flex-col border-l border-white/15 bg-[var(--color-drawer-bg)] shadow-2xl md:hidden"
        >
          <div className="flex items-center justify-between border-b border-white/15 px-4 py-4">
            <span className="text-sm font-medium text-[var(--color-header-text)]">Menu</span>
            <button
              type="button"
              className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-lg border-0 bg-transparent text-[var(--color-header-link)] hover:bg-white/15 hover:text-[var(--color-warm-light)]"
              aria-label="Fechar menu"
              onClick={closeMenu}
            >
              <FiX className="h-6 w-6" aria-hidden />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
            <Link
              to="/client#marcar"
              className={`flex min-h-[44px] w-full items-center rounded-lg px-3 py-2 text-base font-medium ${navLinkClass}`}
              onClick={closeMenu}
            >
              Marcar
            </Link>
            <Link
              to="/client/appointments"
              className={`flex min-h-[44px] w-full items-center rounded-lg px-3 py-2 text-base font-medium ${navLinkClass}`}
              onClick={closeMenu}
            >
              Minhas marcações
            </Link>
            <Link
              to="/profile"
              className={`flex min-h-[44px] w-full items-center rounded-lg px-3 py-2 text-base font-medium ${navLinkClass}`}
              onClick={closeMenu}
            >
              Perfil
            </Link>
          </nav>
          <div className="border-t border-white/15 p-4">
            <button
              type="button"
              onClick={() => {
                closeMenu();
                signOut();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 py-3 text-base font-medium text-[var(--color-header-text)] hover:border-[var(--color-warm-light)]/50 hover:bg-white/15 hover:text-[var(--color-warm-light)]"
            >
              <FiLogOut className="h-5 w-5 shrink-0" aria-hidden />
              Sair
            </button>
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="relative flex items-center justify-between gap-4 bg-[var(--color-header-bg)] px-4 py-4 sm:px-8 sm:py-6">
        <img
          src={logoImg}
          alt="BeautyOn"
          className="h-14 w-auto max-w-[160px] shrink-0 object-contain sm:h-[72px] sm:max-w-[200px] md:h-20 md:max-w-[220px]"
        />
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/client#marcar" className={navLinkClass}>
            Marcar
          </Link>
          <Link to="/client/appointments" className={navLinkClass}>
            Minhas marcações
          </Link>
          <Link to="/profile" className={navLinkClass}>
            Perfil
          </Link>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sair"
            title="Sair"
            className="ml-1 shrink-0 rounded-lg border-0 bg-transparent p-2 text-[var(--color-header-link)] hover:bg-white/15 hover:text-[var(--color-warm-light)]"
          >
            <FiLogOut className="h-6 w-6" aria-hidden />
          </button>
        </nav>
        <button
          type="button"
          className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-[var(--color-header-link)] hover:bg-white/15 hover:text-[var(--color-warm-light)] md:hidden"
          aria-expanded={menuOpen}
          aria-controls="client-mobile-nav"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => setMenuOpen(o => !o)}
        >
          {menuOpen ? <FiX className="h-6 w-6" aria-hidden /> : <FiMenu className="h-6 w-6" aria-hidden />}
        </button>
      </header>

      {mobileMenuLayer}

      <div className="mx-auto max-w-[1120px] px-6 pb-20 pt-8">
        <section aria-labelledby="upcoming-heading">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="upcoming-heading" className="m-0 text-xl font-semibold text-[var(--color-text-white)]">
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
                    <span className="mb-1.5 block text-[15px] text-[var(--color-text-white)]">
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
            <h2 id="book-heading" className="m-0 text-xl font-semibold text-[var(--color-text-white)]">
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
