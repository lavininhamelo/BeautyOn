import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import api from '../../services/api';
import AvatarImg from '../Avatar';

import { cn } from '../../lib/utils';

export interface ProviderApiItem {
  id: number;
  name: string;
  email: string;
  avatar: { url: string } | null;
}

interface ProviderPickerProps {
  bookPath: (id: number) => string;
  onSelectProvider?: (id: number) => void;
  title?: string;
  backTo?: string;
  hideBack?: boolean;
}

const ProviderPicker: React.FC<ProviderPickerProps> = ({
  bookPath,
  onSelectProvider,
  title = 'Profissionais',
  backTo = '/',
  hideBack = false,
}) => {
  const [providers, setProviders] = useState<ProviderApiItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ProviderApiItem[]>('/providers')
      .then(res => {
        if (!cancelled) setProviders(res.data);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1120px] px-6 pb-20 pt-12">
        <p>A carregar…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px] px-6 pb-20 pt-12">
      <header className="mb-8 flex items-center gap-4">
        {!hideBack && (
          <Link
            to={backTo}
            className="flex items-center text-2xl leading-none text-[var(--color-light-gray)] hover:text-[var(--color-primary)]"
          >
            ‹
          </Link>
        )}
        <h1 className="m-0 text-[28px] text-[var(--color-white)]">{title}</h1>
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-6">
        {providers.map(p => {
          const card = (
            <div
              className={cn(
                'flex flex-col items-center gap-4 rounded-[10px] bg-[var(--color-black-medium)] p-6 transition-transform hover:-translate-y-0.5',
              )}
            >
              <AvatarImg
                name={p.name}
                src={p.avatar?.url}
                style={{ width: '128px', height: '128px', borderRadius: '50%' }}
              />
              <strong className="text-center text-[var(--color-white)]">
                {p.name}
              </strong>
            </div>
          );
          if (onSelectProvider) {
            return (
              <button
                key={p.id}
                type="button"
                className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left no-underline"
                onClick={() => onSelectProvider(p.id)}
              >
                {card}
              </button>
            );
          }
          return (
            <Link key={p.id} to={bookPath(p.id)} className="no-underline">
              {card}
            </Link>
          );
        })}
      </div>
      {providers.length === 0 && <p>Nenhum profissional disponível.</p>}
    </div>
  );
};

export default ProviderPicker;
