'use client';

import { useState, useEffect, useRef } from 'react';
import { Menu, X, Home, ClipboardCheck, Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import SidebarLogout from './SidebarLogout';

interface MobileSidebarProps {
  userEmail: string;
  userName: string | null;
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/review', label: 'New Review', icon: ClipboardCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function MobileSidebar({ userEmail, userName }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  return (
    <>
      {/* Mobile header bar — visible below lg (1024px) */}
      <header className="lg:hidden bg-sidebar-bg text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-lg font-bold">
          <span className="text-[#FF7F11]">QA</span> Automation
        </h1>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out sidebar panel */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full w-72 bg-sidebar-bg text-white z-50 lg:hidden transform transition-transform duration-300 ease-in-out flex flex-col ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-[#FF7F11]">QA</span> Automation
          </h1>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-3">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#FF7F11] flex items-center justify-center text-xs font-bold uppercase">
              {userEmail[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{userName || userEmail.split('@')[0]}</p>
              <p className="text-xs text-gray-400 truncate">{userEmail}</p>
            </div>
          </div>
          <SidebarLogout />
        </div>
      </div>
    </>
  );
}
