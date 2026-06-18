"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { bucketLabel } from "@/lib/utils";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

interface BucketAllocationChartProps {
  data: Array<{ bucket: string; value: number; pct: number }>;
}

export function BucketAllocationChart({ data }: BucketAllocationChartProps) {
  const chartData = data.map((d) => ({
    name: bucketLabel(d.bucket),
    value: d.value,
    pct: d.pct,
  }));

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-slate-500">Nessuna allocazione da mostrare.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={({ name, pct }) => `${name} ${pct.toFixed(1)}%`}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) =>
            new Intl.NumberFormat("it-IT", {
              style: "currency",
              currency: "EUR",
            }).format(value)
          }
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
