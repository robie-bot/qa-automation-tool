'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';

interface SidebarLogoutProps {
  mobile?: boolean;
}

export default function SidebarLogout({ mobile }: SidebarLogoutProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      setLoading(false);
    }
  };

  if (mobile) {
    return (
      <button
        onClick={handleLogout}
        disabled={loading}
        className="text-sm text-gray-300 hover:text-white transition-colors disabled:opacity-50"
      >
        {loading ? '...' : 'Logout'}
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
    >
      <LogOut className="w-4 h-4" />
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}
