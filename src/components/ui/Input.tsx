'use client';

import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-t-primary mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-lg border px-4 py-2.5 text-sm text-t-primary bg-input-bg placeholder:text-t-tertiary',
            'transition-all duration-200 outline-none',
            'focus:border-[#FF7F11] focus:ring-2 focus:ring-[#FF7F11]/20',
            error ? 'border-[#E53E3E]' : 'border-input-border',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-[#E53E3E]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
