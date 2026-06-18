export function evaluateRevengeTrading(input: {
  side: "BUY" | "SELL";
  dailyLossPct: number;
  revengeTradingLossPct: number;
}): { warnings: string[]; reasons: string[] } {
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (input.side !== "BUY") return { warnings, reasons };

  if (input.dailyLossPct <= -input.revengeTradingLossPct) {
    reasons.push(
      `Possibile revenge trading: perdita giornaliera (${input.dailyLossPct.toFixed(2)}%) oltre soglia.`,
    );
  } else if (input.dailyLossPct <= -input.revengeTradingLossPct * 0.5) {
    warnings.push(
      "Giornata in perdita: evita acquisti impulsivi per recuperare.",
    );
  }

  return { warnings, reasons };
}
