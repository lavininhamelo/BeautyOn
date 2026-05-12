import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink } from 'react-router-dom';
import { FiLogOut, FiMenu, FiX } from 'react-icons/fi';

import logoImg from '../../assets/images/logo_white.webp';
import { useAuth } from '../../hooks/auth';
import Avatar from '../Avatar';

type Props = {
  showNav?: boolean;
};

type NavItem = { to: string; label: string; exact?: boolean };

const ProviderHeader: React.FC<Props> = ({ showNav = true }) => {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = user?.name ?? 'Utilizador';

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
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const nav = useMemo<NavItem[]>(
    () => [
      { to: '/provider', label: 'Agenda', exact: true },
      { to: '/provider/schedule', label: 'Horários' },
      { to: '/provider/services', label: 'Serviços' },
      { to: '/provider/book', label: 'Marcar para cliente' },
      { to: '/provider/clients', label: 'Clientes' },
    ],
    [],
  );

  const navLinkClass =
    'text-base font-medium text-[var(--color-header-link-muted)] no-underline hover:text-[var(--color-warm-light)] [&.active]:text-[var(--color-warm-light)]';

  const closeMenu = () => setMenuOpen(false);

  const mobileMenuLayer =
    showNav &&
    menuOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm lg:hidden"
          aria-label="Fechar menu"
          onClick={closeMenu}
        />
        <div
          id="provider-mobile-nav"
          className="fixed right-0 top-0 z-[1010] flex h-full w-[min(20rem,88vw)] flex-col border-l border-white/15 bg-[var(--color-drawer-bg)] shadow-2xl lg:hidden"
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
            {nav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                exact={item.exact}
                activeClassName="active"
                className={`flex min-h-[44px] w-full items-center rounded-lg px-3 py-2 ${navLinkClass}`}
                onClick={closeMenu}
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/profile"
              className="flex min-h-[44px] w-full items-center rounded-lg px-3 py-2 text-base font-medium text-[var(--color-header-link-muted)] no-underline hover:bg-white/15 hover:text-[var(--color-warm-light)]"
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
    <>
      <header className="relative bg-[var(--color-header-bg)] py-6 md:py-8">
      <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-4 sm:px-6">
        <img
          src={logoImg}
          alt="BeautyOn"
          className="h-14 w-auto max-h-20 shrink-0 object-contain sm:h-20"
        />

        {showNav && (
          <nav className="ml-4 hidden flex-1 items-center gap-6 lg:ml-12 lg:flex lg:gap-7">
            {nav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                exact={item.exact}
                activeClassName="active"
                className={navLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <div className="flex min-w-0 items-center">
            <Avatar
              name={displayName}
              src={user?.avatar_url}
              alt={displayName}
              className="h-11 w-11 shrink-0 rounded-full object-cover sm:h-14 sm:w-14"
            />
            <div className="ml-3 hidden min-w-0 flex-col leading-6 sm:ml-4 md:flex">
              <span className="truncate text-sm text-[var(--color-header-link-muted)] sm:text-base">
                Bem-vindo,
              </span>
              <Link
                to="/profile"
                className="truncate text-[var(--color-warm-light)] no-underline hover:opacity-90"
                onClick={closeMenu}
              >
                <strong>{displayName}</strong>
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            aria-label="Sair"
            title="Sair"
            className={`shrink-0 rounded-lg border-0 bg-transparent p-2 text-[var(--color-header-link)] hover:bg-white/15 hover:text-[var(--color-warm-light)] ${
              showNav ? 'hidden lg:inline-flex' : 'inline-flex'
            }`}
          >
            <FiLogOut className="h-6 w-6" aria-hidden />
          </button>

          {showNav && (
            <button
              type="button"
              className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-[var(--color-header-link)] hover:bg-white/15 hover:text-[var(--color-warm-light)] lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="provider-mobile-nav"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMenuOpen(o => !o)}
            >
              {menuOpen ? <FiX className="h-6 w-6" aria-hidden /> : <FiMenu className="h-6 w-6" aria-hidden />}
            </button>
          )}
        </div>
      </div>
    </header>
      {mobileMenuLayer}
    </>
  );
};

export default ProviderHeader;
