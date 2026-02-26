import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QA Automation Tool",
  description: "Automated website quality assurance reviews with Playwright",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-[#262626] text-white flex-shrink-0 hidden lg:flex flex-col">
            <div className="p-6 border-b border-white/10">
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Dashboard
                  </a>
                </li>
                <li>
                  <a
                    href="/review"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    New Review
                  </a>
                </li>
              </ul>
            </nav>
            <div className="p-4 border-t border-white/10">
              <p className="text-xs text-gray-500">Powered by Playwright</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-h-screen">
            {/* Mobile header */}
            <header className="lg:hidden bg-[#262626] text-white px-4 py-3 flex items-center justify-between">
              <h1 className="text-lg font-bold">
                <span className="text-[#FF7F11]">QA</span> Automation
              </h1>
              <nav className="flex gap-4">
                <a href="/" className="text-sm text-gray-300 hover:text-white">Dashboard</a>
                <a href="/review" className="text-sm text-gray-300 hover:text-white">Review</a>
              </nav>
            </header>
            <div className="p-6 lg:p-10 max-w-5xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
