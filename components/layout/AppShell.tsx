import { NavLinks } from "./NavLinks";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-[var(--card-border)] bg-[var(--card)] p-4">
        <div className="mb-8">
          <h1 className="text-lg font-bold text-white">Seb Capital</h1>
          <p className="text-xs text-slate-500">Capital System v2</p>
        </div>
        <NavLinks />
        <footer className="mt-auto pt-8 text-xs leading-relaxed text-slate-500">
          Strumento personale — nessuna promessa di rendimento.
        </footer>
      </aside>
      <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
