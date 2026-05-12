import React, { useEffect, useRef } from 'react';
import { useField } from '@unform/core';

import { cn } from '../../lib/utils';

type Props = {
  name: string;
  children: React.ReactNode;
  className?: string;
};

const FormCheckboxField: React.FC<Props> = ({ name, children, className }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { fieldName, defaultValue, registerField } = useField(name);

  useEffect(() => {
    registerField({
      name: fieldName,
      ref: inputRef.current,
      path: 'checked',
    });
  }, [fieldName, registerField]);

  return (
    <label className={cn('flex cursor-pointer select-none items-center gap-2.5', className)}>
      <input
        ref={inputRef}
        type="checkbox"
        name={name}
        defaultChecked={defaultValue === true}
        className="h-[18px] w-[18px] accent-[var(--color-primary)]"
      />
      {children}
    </label>
  );
};

export default FormCheckboxField;
