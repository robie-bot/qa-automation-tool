import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SidebarLogout from '@/components/SidebarLogout';
import ThemeToggle from '@/components/ThemeToggle';
import MobileSidebar from '@/components/MobileSidebar';
import { Home, ClipboardCheck, Settings as SettingsIcon } from 'lucide-react';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar — visible at lg (1024px) and up */}
      <aside className="w-64 bg-sidebar-bg text-white flex-shrink-0 hidden lg:flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-[#FF7F11]">QA</span> Automation
          </h1>
          <p className="text-xs text-gray-400 mt-1">Website Review Tool</p>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            <li>
              <a
                href="/"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </a>
            </li>
            <li>
              <a
                href="/review"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <ClipboardCheck className="w-4 h-4" />
                New Review
              </a>
            </li>
            <li>
              <a
                href="/settings"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </a>
            </li>
          </ul>
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-3">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#FF7F11] flex items-center justify-center text-xs font-bold uppercase">
              {user.email[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{user.name || user.email.split('@')[0]}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <SidebarLogout />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen bg-background">
        {/* Mobile slide-out sidebar + hamburger header — below lg (1024px) */}
        <MobileSidebar userEmail={user.email} userName={user.name || null} />

        <div className="p-6 lg:p-10 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
