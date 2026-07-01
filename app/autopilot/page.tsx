import { AutopilotClient } from "@/components/autopilot/AutopilotClient";
import {
  buildDailyDecisionBrief,
  getLatestDailyDecisionBrief,
} from "@/lib/autopilot";

export default async function AutopilotPage() {
  const stored = await getLatestDailyDecisionBrief();
  const brief = stored ?? (await buildDailyDecisionBrief());

  return <AutopilotClient initialBrief={brief} />;
}
