import React, { useEffect } from 'react';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiXCircle,
} from 'react-icons/fi';
import { animated } from 'react-spring';

import { cn } from '../../../lib/utils';
import { ToastMessage, useToast } from '../../../hooks/toast';

interface ToastProps {
  message: ToastMessage;
  style: object;
}
const icons = {
  info: <FiInfo size={24} />,
  success: <FiCheckCircle size={24} />,
  error: <FiAlertCircle size={24} />,
};

const typeStyles = {
  info: 'bg-[var(--color-toast-info-background)] text-[var(--color-toast-info-text)]',
  success:
    'bg-[var(--color-toast-success-background)] text-[var(--color-toast-success-text)]',
  error:
    'bg-[var(--color-toast-error-background)] text-[var(--color-toast-error-text)]',
};

const Toast: React.FunctionComponent<ToastProps> = ({ message, style }) => {
  const { removeToast } = useToast();
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(message.id);
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [removeToast, message.id]);

  const type = message.type || 'info';
  const hasDescription = !!message.description;

  return (
    <animated.div
      style={style}
      role="alert"
      onClick={() => removeToast(message.id)}
      className={cn(
        'pointer-events-auto relative mb-2 flex w-[360px] max-w-[calc(100vw-3.75rem)] cursor-pointer rounded-[0.625rem] py-4 pl-4 pr-[3.25rem] shadow-md outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        typeStyles[type],
        !hasDescription && 'items-center',
      )}
    >
      <span className={cn('mr-3 shrink-0', !hasDescription && 'mt-0')}>
        {icons[type]}
      </span>
      <div className="min-w-0 flex-1">
        <strong>{message.title}</strong>
        {message.description && (
          <p className="mt-1 text-sm leading-5 opacity-80">
            {message.description}
          </p>
        )}
      </div>

      <button
        onClick={e => {
          e.stopPropagation();
          removeToast(message.id);
        }}
        type="button"
        aria-label="Fechar notificação"
        className={cn(
          'absolute right-2 top-1/2 flex h-11 min-h-[44px] w-11 min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg border-0 bg-transparent opacity-70 hover:opacity-100',
          hasDescription && 'top-[1.1875rem] translate-y-0',
        )}
      >
        <FiXCircle size={18} aria-hidden />
      </button>
    </animated.div>
  );
};

export default Toast;
