'use client';

import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  hoverable?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, selected, hoverable, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border bg-white p-5 transition-all duration-200',
          hoverable && 'cursor-pointer hover:shadow-md hover:border-[#FF7F11]/40',
          selected && 'border-[#FF7F11] ring-2 ring-[#FF7F11]/20 shadow-md',
          !selected && 'border-gray-200',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
export default Card;
