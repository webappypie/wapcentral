import React from 'react';
import { cn } from '../lib/utils.js';

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  pulse?: boolean;
  label?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  pulse = true,
  label,
  className,
  ...props
}) => {
  const colorMap = {
    healthy: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    unhealthy: 'bg-rose-500',
    unknown: 'bg-slate-400',
  };

  const textMap = {
    healthy: 'text-emerald-700 dark:text-emerald-300',
    degraded: 'text-amber-700 dark:text-amber-300',
    unhealthy: 'text-rose-700 dark:text-rose-300',
    unknown: 'text-slate-600 dark:text-slate-400',
  };

  return (
    <span
      className={cn('inline-flex items-center gap-2 text-xs font-medium', className)}
      {...props}
    >
      <span className="relative flex h-2.5 w-2.5">
        {pulse && status === 'healthy' && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              colorMap[status],
            )}
          />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', colorMap[status])} />
      </span>
      {label && <span className={textMap[status]}>{label}</span>}
    </span>
  );
};
StatusIndicator.displayName = 'StatusIndicator';
