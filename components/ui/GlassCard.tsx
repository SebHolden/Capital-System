import { cn } from "@/lib/utils";

interface GlassCardProps {
  className?: string;
  children: React.ReactNode;
  glow?: "success" | "danger" | "accent" | "warning";
  gradient?: "success" | "danger" | "accent" | "warning";
  solid?: boolean;
}

export function GlassCard({
  className,
  children,
  glow,
  gradient,
  solid = false,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5 transition-all duration-300",
        solid ? "glass-solid" : "glass",
        glow && `glow-${glow}`,
        gradient && `gradient-${gradient}`,
        className
      )}
    >
      {children}
    </div>
  );
}

export function GlassCardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={cn("text-xs font-medium uppercase tracking-wider text-slate-400", className)}>
      {children}
    </h3>
  );
}

export function GlassCardValue({
  className,
  children,
  size = "default",
}: {
  className?: string;
  children: React.ReactNode;
  size?: "sm" | "default" | "lg" | "xl";
}) {
  const sizeClasses = {
    sm: "text-lg",
    default: "text-2xl",
    lg: "text-3xl",
    xl: "text-4xl",
  };

  return (
    <p className={cn("mt-2 font-bold tracking-tight", sizeClasses[size], className)}>
      {children}
    </p>
  );
}
