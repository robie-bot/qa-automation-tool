'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
            theme === opt.value
              ? 'bg-[#FF7F11] text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          title={opt.label}
        >
          <opt.icon className="w-3 h-3 flex-shrink-0" />
          {opt.label}
        </button>
      ))}
    </div>
  );
}
