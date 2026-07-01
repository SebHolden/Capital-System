"use client";

interface RiskGaugeProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function RiskGauge({ value, max = 100, size = "md", showLabel = true }: RiskGaugeProps) {
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const rotation = percentage * 180;

  const sizeConfig = {
    sm: { width: 100, height: 60, strokeWidth: 8, fontSize: "text-lg" },
    md: { width: 160, height: 90, strokeWidth: 10, fontSize: "text-2xl" },
    lg: { width: 200, height: 110, strokeWidth: 12, fontSize: "text-3xl" },
  };

  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = Math.PI * radius;

  const getColor = (val: number) => {
    if (val <= 25) return "#22c55e";
    if (val <= 50) return "#f59e0b";
    if (val <= 75) return "#f97316";
    return "#ef4444";
  };

  const color = getColor(value);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={config.width}
        height={config.height}
        viewBox={`0 0 ${config.width} ${config.height}`}
      >
        <path
          d={`M ${config.strokeWidth / 2} ${config.height - 5}
              A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${config.height - 5}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={`M ${config.strokeWidth / 2} ${config.height - 5}
              A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${config.height - 5}`}
          fill="none"
          stroke={color}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * percentage} ${circumference}`}
          style={{
            filter: `drop-shadow(0 0 8px ${color}80)`,
          }}
        />
      </svg>
      {showLabel && (
        <div className="mt-2 text-center">
          <span className={`font-bold ${config.fontSize}`} style={{ color }}>
            {value}
          </span>
          <span className="text-slate-400">/{max}</span>
        </div>
      )}
    </div>
  );
}

export function MiniGauge({
  value,
  label,
  color = "success",
}: {
  value: string;
  label: string;
  color?: "success" | "danger" | "warning" | "accent";
}) {
  const colorClasses = {
    success: "text-green-400",
    danger: "text-red-400",
    warning: "text-amber-400",
    accent: "text-blue-400",
  };

  return (
    <div className="glass rounded-xl p-4 text-center">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}
