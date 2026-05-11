import React from 'react';

import { cn } from '../../lib/utils';

type BaseProps = {
  label: string;
  fullWidth?: boolean;
};

type InputProps = BaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> & {
    multiline?: false;
  };

type TextAreaProps = BaseProps &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> & {
    multiline: true;
  };

type Props = InputProps | TextAreaProps;

const controlClass =
  'rounded-lg border border-[var(--color-hard-gray)] bg-[var(--color-inputs)] px-3 py-3 text-[var(--color-primary-darken)] placeholder:text-[var(--color-hard-gray)] focus:border-[var(--color-primary)] focus:outline-none';

const TextField: React.FC<Props> = props => {
  const { label, fullWidth } = props;

  if ('multiline' in props && props.multiline) {
    const { label: _l, fullWidth: _f, multiline: _m, ...areaProps } = props;
    return (
      <label
        className={cn(
          'flex flex-col gap-2 text-sm text-[var(--color-light-gray)]',
          fullWidth && 'w-full',
        )}
      >
        {label}
        <textarea
          {...areaProps}
          className={cn(controlClass, 'min-h-[140px] w-full resize-y')}
        />
      </label>
    );
  }

  const { label: _l2, fullWidth: _f2, multiline: _m2, ...inputProps } =
    props as InputProps;

  return (
    <label
      className={cn(
        'flex flex-col gap-2 text-sm text-[var(--color-light-gray)]',
        fullWidth && 'w-full',
      )}
    >
      {label}
      <input {...inputProps} className={cn(controlClass)} />
    </label>
  );
};

export default TextField;
