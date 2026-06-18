import { cn } from "@/lib/utils";

const variants = {
  default: "bg-slate-700 text-slate-200",
  success: "bg-emerald-900/50 text-emerald-300 border border-emerald-800",
  warning: "bg-amber-900/50 text-amber-300 border border-amber-800",
  danger: "bg-red-900/50 text-red-300 border border-red-800",
  muted: "bg-slate-800 text-slate-400 border border-slate-700",
};

export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: keyof typeof variants;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
