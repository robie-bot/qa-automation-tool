'use client';

import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function Progress({ value, max = 100, className, size = 'md', showLabel }: ProgressProps) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full bg-surface-secondary rounded-full overflow-hidden', sizes[size])}>
        <div
          className="h-full bg-[#FF7F11] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-t-secondary mt-1 text-right">{Math.round(percent)}%</p>
      )}
    </div>
  );
}
