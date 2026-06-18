import type { StressScenario } from "./types";

const SCENARIOS = [
  { label: "Stress -5%", drawdownPct: -5 },
  { label: "Stress -10%", drawdownPct: -10 },
  { label: "Stress -20%", drawdownPct: -20 },
];

export function runStressTest(portfolioValue: number): StressScenario[] {
  return SCENARIOS.map((scenario) => {
    const lossAmount = portfolioValue * (Math.abs(scenario.drawdownPct) / 100);
    return {
      label: scenario.label,
      drawdownPct: scenario.drawdownPct,
      portfolioValue: portfolioValue - lossAmount,
      lossAmount,
    };
  });
}
