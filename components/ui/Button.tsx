import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-500",
  secondary: "bg-slate-700 text-slate-100 hover:bg-slate-600",
  danger: "bg-red-700 text-white hover:bg-red-600",
  ghost: "bg-transparent text-slate-300 hover:bg-slate-800",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
