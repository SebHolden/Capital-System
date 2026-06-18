import { AppShell } from "@/components/layout/AppShell";

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
