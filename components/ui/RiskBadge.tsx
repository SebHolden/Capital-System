import type { RiskLevel } from "@prisma/client";
import { Badge } from "./Badge";

const riskStyles: Record<RiskLevel, { variant: "success" | "warning" | "danger" | "muted"; label: string }> = {
  GREEN: { variant: "success", label: "GREEN" },
  YELLOW: { variant: "warning", label: "YELLOW" },
  ORANGE: { variant: "warning", label: "ORANGE" },
  RED: { variant: "danger", label: "RED" },
  BLACK: { variant: "muted", label: "BLACK" },
};

export function RiskBadge({ level }: { level: RiskLevel | string }) {
  const config = riskStyles[level as RiskLevel] ?? riskStyles.YELLOW;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
