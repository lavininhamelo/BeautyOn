import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiImage, FiX } from 'react-icons/fi';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

/** Horizontal scroll file preview (shadcnblocks-style); no Dice UI for React 16 compatibility. */

export type ExistingRecordPhoto = {
  id: number;
  url: string;
  name?: string;
};

type Props = {
  value: File[];
  onValueChange: (files: File[]) => void;
  existingPhotos: ExistingRecordPhoto[];
  maxFiles?: number;
  maxSizeBytes?: number;
  disabled?: boolean;
  onInvalid?: (message: string) => void;
  className?: string;
};

const defaultMaxFiles = 10;
const defaultMaxBytes = 10 * 1024 * 1024;

function formatSizePt(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const n = bytes / 1024 ** i;
  const rounded = i === 0 ? String(Math.round(n)) : n.toFixed(1).replace('.', ',');
  return `${rounded} ${units[i]}`;
}

export const AppointmentRecordFileUploadPreview: React.FC<Props> = ({
  value,
  onValueChange,
  existingPhotos,
  maxFiles = defaultMaxFiles,
  maxSizeBytes = defaultMaxBytes,
  disabled = false,
  onInvalid,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const totalCount = existingPhotos.length + value.length;
  const remainingSlots = Math.max(0, maxFiles - existingPhotos.length);

  const [newPreviewEntries, setNewPreviewEntries] = useState<
    { file: File; url: string }[]
  >([]);
  const previewRef = useRef<{ file: File; url: string }[]>([]);

  useEffect(() => {
    setNewPreviewEntries(prev => {
      for (const e of prev) {
        if (!value.includes(e.file)) URL.revokeObjectURL(e.url);
      }
      const next = value.map(file => {
        const kept = prev.find(e => e.file === file);
        return kept ?? { file, url: URL.createObjectURL(file) };
      });
      previewRef.current = next;
      return next;
    });
  }, [value]);

  useEffect(() => {
    return () => {
      previewRef.current.forEach(e => URL.revokeObjectURL(e.url));
    };
  }, []);

  const ingest = useCallback(
    (incoming: File[]) => {
      if (disabled) return;
      if (remainingSlots === 0) {
        if (incoming.length > 0) {
          onInvalid?.(
            `Não é possível adicionar mais imagens: limite de ${maxFiles} atingido para este registo.`,
          );
        }
        return;
      }
      const asImages = incoming.filter(f => f.type.startsWith('image/'));
      if (asImages.length < incoming.length) {
        onInvalid?.('Só são aceites imagens (PNG, JPEG, WebP, etc.).');
      }
      const withinSize = asImages.filter(f => {
        if (f.size > maxSizeBytes) {
          onInvalid?.(
            `O ficheiro «${f.name}» ultrapassa o limite de ${formatSizePt(maxSizeBytes)}.`,
          );
          return false;
        }
        return true;
      });
      if (withinSize.length === 0) return;

      const merged: File[] = [...value];
      for (const f of withinSize) {
        if (merged.length >= remainingSlots) {
          onInvalid?.(
            `Limite de ${maxFiles} imagens por registo (inclui ${existingPhotos.length} já guardadas).`,
          );
          break;
        }
        const dup = merged.some(
          x => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified,
        );
        if (!dup) merged.push(f);
      }
      if (merged.length !== value.length || merged.some((f, i) => f !== value[i])) {
        onValueChange(merged);
      }
    },
    [
      disabled,
      existingPhotos.length,
      maxFiles,
      maxSizeBytes,
      onInvalid,
      onValueChange,
      remainingSlots,
      value,
    ],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    ingest(list);
    e.target.value = '';
  };

  const removeAt = (index: number) => {
    onValueChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Área para largar imagens ou abrir o seletor de ficheiros"
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={e => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={e => {
          e.preventDefault();
          e.stopPropagation();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDragOver={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          if (disabled) return;
          ingest(Array.from(e.dataTransfer.files ?? []));
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragOver
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
            : 'border-[var(--color-hard-gray)] bg-[var(--color-shape)]/30',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <div className="flex items-center justify-center rounded-full border border-[var(--color-hard-gray)] p-2.5 text-[var(--color-light-gray)]">
          <FiImage className="h-6 w-6" aria-hidden />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-[var(--color-text-white)]">Adicionar imagens</p>
          <p className="text-xs text-[var(--color-light-gray)]">
            Pré-visualização com scroll horizontal. Até {maxFiles} imagens no total; máximo{' '}
            {formatSizePt(maxSizeBytes)} por ficheiro.
          </p>
          <p className="text-xs text-[var(--color-light-gray)]">
            Arraste imagens para aqui ou utilize o botão abaixo.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={onInputChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1 border-[var(--color-hard-gray)] bg-[var(--color-black-medium)] text-[var(--color-text-white)] hover:bg-[var(--color-shape)]"
          disabled={disabled || remainingSlots === 0}
          onClick={() => inputRef.current?.click()}
        >
          Selecionar imagens
        </Button>
      </div>

      {(existingPhotos.length > 0 || newPreviewEntries.length > 0) && (
        <div
          className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]"
          aria-label="Pré-visualização das imagens"
        >
          {existingPhotos.map(p => (
            <div
              key={`existing-${p.id}`}
              className="relative flex w-24 shrink-0 flex-col gap-1 rounded-md border border-[var(--color-hard-gray)] bg-[var(--color-shape)] p-2"
            >
              <div className="mx-auto h-20 w-20 overflow-hidden rounded-md bg-[var(--color-black-medium)]">
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              </div>
              <span className="w-full truncate text-center text-[10px] text-[var(--color-light-gray)]">
                Guardada
              </span>
            </div>
          ))}
          {newPreviewEntries.map((entry, index) => (
            <div
              key={entry.url}
              className="relative flex w-24 shrink-0 flex-col gap-1 rounded-md border border-[var(--color-hard-gray)] bg-[var(--color-shape)] p-2"
            >
              <div className="mx-auto h-20 w-20 overflow-hidden rounded-md bg-[var(--color-black-medium)]">
                <img src={entry.url} alt="" className="h-full w-full object-cover" />
              </div>
              <span
                className="w-full truncate text-center text-xs text-[var(--color-primary-darken)]"
                title={entry.file.name}
              >
                {entry.file.name}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute -right-1 -top-1 h-5 w-5 min-w-0 rounded-full border border-[var(--color-hard-gray)] p-0 text-[var(--color-text-white)]"
                onClick={() => removeAt(index)}
                disabled={disabled}
                aria-label={`Remover ${entry.file.name}`}
              >
                <FiX className="mx-auto h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {totalCount > 0 && (
        <p className="mt-1 text-xs text-[var(--color-light-gray)]">
          {totalCount} de {maxFiles} imagens
          {remainingSlots === 0 ? ' (limite atingido para novas imagens neste registo)' : ''}.
        </p>
      )}
    </div>
  );
};
