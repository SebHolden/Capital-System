import { Badge } from "@/components/ui/Badge";
import type { PriceStatus } from "@/lib/prices/types";

const config: Record<
  PriceStatus,
  { variant: "success" | "warning" | "danger" | "muted"; label: string }
> = {
  fresh: { variant: "success", label: "Fresh" },
  stale: { variant: "warning", label: "Stale" },
  manual: { variant: "muted", label: "Manual" },
  missing: { variant: "danger", label: "Missing" },
};

export function PriceStatusBadge({ status }: { status: PriceStatus | string }) {
  const item = config[status as PriceStatus] ?? config.manual;
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
