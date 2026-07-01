import Link from "next/link";
import { NavLinks } from "./NavLinks";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-52 flex-col border-r border-slate-800/50 bg-slate-900/50 backdrop-blur-xl">
        <div className="p-6">
          <Link href="/dashboard" className="group flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-500/30">
              S
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">SEB CAPITAL</h1>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3">
          <NavLinks />
        </nav>

        <div className="border-t border-slate-800/50 p-4">
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-white">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="ml-52 min-h-screen flex-1 pb-20">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
