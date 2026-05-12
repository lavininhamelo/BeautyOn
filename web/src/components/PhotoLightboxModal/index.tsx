import React, { useCallback, useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';

import { Modal } from '../ui/modal';

export type PhotoLightboxSlide = {
  url: string;
  alt?: string;
  caption?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  slides: PhotoLightboxSlide[];
  initialIndex?: number;
};

function clampIndex(i: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(0, i), count - 1);
}

export const PhotoLightboxModal: React.FC<Props> = ({
  open,
  onClose,
  slides,
  initialIndex = 0,
}) => {
  const count = slides.length;
  const [index, setIndex] = useState(() => clampIndex(initialIndex, count));

  useEffect(() => {
    setIndex(clampIndex(initialIndex, count));
  }, [initialIndex, count]);

  const goPrev = useCallback(() => {
    setIndex(i => (count <= 1 ? i : i <= 0 ? count - 1 : i - 1));
  }, [count]);

  const goNext = useCallback(() => {
    setIndex(i => (count <= 1 ? i : i >= count - 1 ? 0 : i + 1));
  }, [count]);

  useEffect(() => {
    if (!open || count <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, count, goPrev, goNext]);

  if (!open || count === 0) return null;

  const safe = clampIndex(index, count);
  const current = slides[safe];

  return (
    <Modal
      open={open}
      onClose={onClose}
      hideChrome
      panelClassName="max-w-[min(96vw,1200px)] w-full border-0 bg-transparent p-0 shadow-none"
    >
      <div className="relative flex flex-col items-stretch rounded-xl bg-[#0d0a0d]/92 p-3 sm:p-5">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3 text-[var(--color-light-gray)]">
          <span className="text-sm tabular-nums">
            {safe + 1} de {count}
          </span>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-black/55 text-white hover:bg-black/70"
            onClick={onClose}
            aria-label="Fechar"
          >
            <FiX className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="relative flex min-h-[min(72vh,640px)] items-center justify-center">
          {count > 1 && (
            <button
              type="button"
              className="absolute left-0 z-[2] inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] bg-black/50 text-white hover:bg-black/70 sm:left-1"
              onClick={e => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Imagem anterior"
            >
              <FiChevronLeft className="h-6 w-6" />
            </button>
          )}

          <div className="mx-10 flex max-h-[min(78vh,720px)] w-full flex-1 items-center justify-center sm:mx-14">
            <img
              src={current.url}
              alt={current.alt ?? 'Imagem do registo'}
              className="max-h-[min(78vh,720px)] max-w-full object-contain"
            />
          </div>

          {count > 1 && (
            <button
              type="button"
              className="absolute right-0 z-[2] inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] bg-black/50 text-white hover:bg-black/70 sm:right-1"
              onClick={e => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Imagem seguinte"
            >
              <FiChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>

        {current.caption ? (
          <p className="mt-3 text-center text-sm text-[var(--color-light-gray)]">{current.caption}</p>
        ) : null}

        {count > 1 && (
          <p className="mt-2 text-center text-xs text-[var(--color-hard-gray)]">
            Utilize as setas do teclado ou os botões para navegar.
          </p>
        )}
      </div>
    </Modal>
  );
};
