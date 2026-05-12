import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  panelClassName?: string;
  hideChrome?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  panelClassName,
  hideChrome = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : hideChrome ? undefined : 'modal-title'}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-[1] flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-[var(--color-input-border)] bg-[var(--color-white)] shadow-xl',
          panelClassName ?? 'max-w-lg',
        )}
      >
        {!hideChrome && (
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-input-border)] px-5 py-4">
            <h2
              id="modal-title"
              className="m-0 text-lg font-semibold text-[var(--color-text-white)]"
            >
              {title ?? ' '}
            </h2>
            <button
              type="button"
              className="rounded-lg border border-[var(--color-input-border)] bg-[var(--color-inputs)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-white)] hover:bg-[var(--color-disabled-bg)]"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        )}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto',
            hideChrome ? 'p-0' : 'px-5 py-5',
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
