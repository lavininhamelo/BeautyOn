import React, { useMemo } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FiPower } from 'react-icons/fi';

import logoImg from '../../assets/images/logo.png';
import { useAuth } from '../../hooks/auth';
import Avatar from '../Avatar';

type Props = {
  showNav?: boolean;
};

type NavItem = { to: string; label: string; exact?: boolean };

const ProviderHeader: React.FC<Props> = ({ showNav = true }) => {
  const { user, signOut } = useAuth();

  const displayName = user?.name ?? 'Utilizador';

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

  return (
    <header className="bg-[var(--color-black-medium)] py-8">
      <div className="mx-auto flex max-w-[1120px] items-center px-6">
        <img
          src={logoImg}
          alt="BeautyOn"
          className="h-20 w-auto max-h-20 shrink-0 object-contain"
        />

        {showNav && (
          <nav className="ml-12 flex items-center gap-7">
            {nav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                exact={item.exact}
                activeClassName="active"
                className="text-base font-medium text-[var(--color-light-gray)] no-underline hover:text-[var(--color-primary)] [&.active]:text-[var(--color-primary)]"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-5">
          <div className="flex items-center">
            <Avatar
              name={displayName}
              src={user?.avatar_url}
              alt={displayName}
              className="h-14 w-14 rounded-full object-cover"
            />
            <div className="ml-4 flex flex-col leading-6">
              <span className="text-[var(--color-white)]">Bem-vindo,</span>
              <Link
                to="/profile"
                className="text-[var(--color-primary)] no-underline hover:opacity-80"
              >
                <strong>{displayName}</strong>
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            aria-label="Sair"
            className="border-0 bg-transparent"
          >
            <FiPower className="h-5 w-5 text-[var(--color-light-gray)] hover:text-[var(--color-primary)]" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default ProviderHeader;
