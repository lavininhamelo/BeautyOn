import React, { ButtonHTMLAttributes } from 'react';

import { Button as UIButton } from '../ui/button';
import { cn } from '../../lib/utils';

type ButtonVariant = NonNullable<
  React.ComponentProps<typeof UIButton>['variant']
>;
type ButtonSize = NonNullable<React.ComponentProps<typeof UIButton>['size']>;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const Button: React.FunctionComponent<ButtonProps> = ({
  children,
  loading,
  type = 'button',
  variant = 'beauty',
  size = 'default',
  className,
  disabled,
  ...rest
}) => {
  const isBeautyForm = variant === 'beauty' && size === 'default';

  return (
    <UIButton
      type={type}
      variant={variant}
      size={size}
      disabled={disabled || loading}
      className={cn(
        isBeautyForm &&
          'mt-4 h-14 w-full rounded-[0.625rem] font-medium transition-colors hover:brightness-95',
        className,
      )}
      {...rest}
    >
      {loading ? 'Loading...' : children}
    </UIButton>
  );
};

export default Button;
