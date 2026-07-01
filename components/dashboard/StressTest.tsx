"use client";

import { formatCurrency } from "@/lib/utils";

interface StressTestProps {
  scenarios: Array<{
    label: string;
    drawdownPct: number;
    lossAmount: number;
    portfolioValue: number;
  }>;
}

export function StressTest({ scenarios }: StressTestProps) {
  return (
    <div className="overflow-hidden rounded-xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/50">
            <th className="py-3 text-left font-medium text-slate-400">Scenario</th>
            <th className="py-3 text-left font-medium text-slate-400">Loss</th>
            <th className="py-3 text-right font-medium text-slate-400">Value Remaining</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((scenario) => (
            <tr
              key={scenario.label}
              className="border-b border-slate-800/50 transition-colors hover:bg-white/[0.02]"
            >
              <td className="py-3 text-slate-300">{scenario.label}</td>
              <td className="py-3 text-red-400">
                -{formatCurrency(scenario.lossAmount)}
              </td>
              <td className="py-3 text-right text-slate-300">
                {formatCurrency(scenario.portfolioValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
