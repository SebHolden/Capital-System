import { getUserSettings, isLiveTradingEnabled } from "@/lib/security";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const settings = await getUserSettings();

  return (
    <SettingsClient
      initialSettings={settings}
      liveTradingEnabled={isLiveTradingEnabled()}
    />
  );
}
