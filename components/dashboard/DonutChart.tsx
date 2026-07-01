"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = {
  CORE: "#3b82f6",
  GROWTH: "#22c55e",
  SPECULATIVE: "#ef4444",
  HEDGE: "#f59e0b",
  CASH: "#8b5cf6",
};

interface DonutChartProps {
  data: Array<{ bucket: string; value: number; pct: number }>;
  centerValue: number;
  centerLabel?: string;
}

export function DonutChart({ data, centerValue, centerLabel = "TOTAL" }: DonutChartProps) {
  const chartData = data.map((d) => ({
    name: d.bucket,
    value: d.value,
    pct: d.pct,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center">
        <p className="text-sm text-slate-500">Nessun dato</p>
      </div>
    );
  }

  return (
    <div className="relative h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
            stroke="none"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[entry.name as keyof typeof COLORS] || "#6b7280"}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {centerLabel}
        </span>
        <span className="mt-1 text-2xl font-bold text-white">
          {formatCurrency(centerValue)}
        </span>
      </div>
    </div>
  );
}

export function DonutLegend({
  data,
}: {
  data: Array<{ bucket: string; value: number; pct: number }>;
}) {
  const labels: Record<string, string> = {
    CORE: "Core ETF",
    GROWTH: "Growth",
    SPECULATIVE: "Speculativo",
    HEDGE: "Hedge",
    CASH: "Cash",
  };

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-4">
      {data.map((item) => (
        <div key={item.bucket} className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{
              backgroundColor: COLORS[item.bucket as keyof typeof COLORS] || "#6b7280",
            }}
          />
          <span className="text-sm text-slate-300">
            {labels[item.bucket] || item.bucket}{" "}
            <span className="text-slate-500">{item.pct.toFixed(0)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}
