import React, {
  InputHTMLAttributes,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { IconBaseProps } from 'react-icons';
import { FiAlertCircle } from 'react-icons/fi';
import { useField } from '@unform/core';

import { cn } from '../../lib/utils';

import Tooltip from '../Tooltip';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  containerStyle?: object;
  icon?: React.ComponentType<IconBaseProps>;
}

const Input: React.FunctionComponent<InputProps> = ({
  name,
  containerStyle = {},
  icon: Icon,
  ...rest
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  const { fieldName, defaultValue, error, registerField } = useField(name);

  const handleInputFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setIsFocused(false);
    setIsFilled(!!inputRef.current?.value);
  }, []);

  useEffect(() => {
    registerField({
      name: fieldName,
      ref: inputRef.current,
      path: 'value',
    });
  }, [fieldName, registerField]);

  const border =
    error != null && error !== ''
      ? 'border-[var(--color-error)]'
      : isFocused
      ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
      : isFilled
      ? 'border-[var(--color-inputs)] text-[var(--color-primary)]'
      : 'border-[var(--color-inputs)] text-[var(--color-hard-gray)]';

  return (
    <div
      style={containerStyle}
      className={cn(
        'flex w-full items-center rounded-[0.625rem] border-2 bg-[var(--color-inputs)] px-[14px] py-[14px]',
        border,
      )}
      data-testid="input-container"
    >
      {Icon && <Icon size={20} className="mr-4 shrink-0" />}
      <input
        className="flex-1 border-0 bg-transparent text-[var(--color-primary-darken)] placeholder:text-[var(--color-hard-gray)] focus:outline-none focus:ring-0"
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        defaultValue={defaultValue}
        ref={inputRef}
        {...rest}
      />
      {error && (
        <Tooltip title={error} className="ml-4 h-5 shrink-0">
          <FiAlertCircle className="text-xl text-[var(--color-error)]" />
        </Tooltip>
      )}
    </div>
  );
};

export default Input;
