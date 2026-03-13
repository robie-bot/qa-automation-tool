'use client';

import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex border-b border-b', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 -mb-px',
            activeTab === tab.id
              ? 'border-[#FF7F11] text-[#FF7F11]'
              : 'border-transparent text-t-tertiary hover:text-t-primary hover:border-b'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'ml-2 rounded-full px-2 py-0.5 text-xs',
                activeTab === tab.id ? 'bg-[#FF7F11]/10 text-[#FF7F11]' : 'bg-surface-secondary text-t-tertiary'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
