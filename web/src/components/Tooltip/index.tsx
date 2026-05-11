import React from 'react';

import { cn } from '../../lib/utils';

interface TooltipProps {
  title: string;
  className?: string;
}

const Tooltip: React.FunctionComponent<TooltipProps> = ({
  title,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'group relative flex items-center justify-center',
        className,
      )}
    >
      {children}
      <span
        className={cn(
          'pointer-events-none invisible absolute bottom-[calc(100%+0.75rem)] left-1/2 z-10 w-[180px] -translate-x-1/2 rounded bg-[var(--color-primary)] px-2 py-2 text-sm font-medium text-[var(--color-background)] opacity-0 transition-opacity duration-300 group-hover:visible group-hover:opacity-100',
          'before:absolute before:left-1/2 before:top-full before:-translate-x-1/2 before:border-[6px] before:border-solid before:border-x-transparent before:border-b-transparent before:border-t-[var(--color-primary)] before:content-[""]',
        )}
      >
        {title}
      </span>
    </div>
  );
};

export default Tooltip;
