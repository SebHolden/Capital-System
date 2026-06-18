import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={cn("text-sm font-medium text-[var(--muted)]", className)}>
      {children}
    </h3>
  );
}

export function CardValue({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("mt-1 text-2xl font-semibold tracking-tight", className)}>
      {children}
    </p>
  );
}
