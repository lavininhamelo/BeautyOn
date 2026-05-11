import React, { useCallback, useMemo, useRef } from 'react';

import { cn } from '../../lib/utils';

type NativeDateInputEl = HTMLInputElement & {
  showPicker?: () => void;
};

export interface DatePickerFieldProps {
  value: string;
  onChange: (next: string) => void;
  displayValue?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  containerStyle?: React.CSSProperties;
  'aria-label'?: string;
}

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  displayValue,
  min,
  max,
  disabled,
  containerStyle,
  'aria-label': ariaLabel = 'Escolher data',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(() => {
    const el = inputRef.current as NativeDateInputEl | null;
    if (!el || disabled) return;

    if (typeof el.showPicker === 'function') {
      el.showPicker();
      return;
    }

    el.click();
  }, [disabled]);

  const buttonText = useMemo(() => displayValue ?? value, [displayValue, value]);

  return (
    <div className="max-w-[380px] px-6 pb-2" style={containerStyle}>
      <div className="relative">
        <input
          ref={inputRef}
          type="date"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className="pointer-events-none absolute h-px w-px opacity-0"
          tabIndex={-1}
          aria-hidden
        />
        <button
          type="button"
          onClick={openPicker}
          aria-label={ariaLabel}
          className={cn(
            'h-12 w-full rounded-[10px] border-0 text-base font-medium',
            'bg-[var(--color-primary)] text-[var(--color-inputs)]',
            'cursor-pointer hover:brightness-105',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          disabled={disabled}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default DatePickerField;
