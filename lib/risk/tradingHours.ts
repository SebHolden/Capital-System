import type { UserSettings } from "@prisma/client";

export interface TradingWindowStatus {
  allowed: boolean;
  currentHour: number;
  message: string;
}

function getHourInTimezone(timezone: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
  return parseInt(hour, 10);
}

export function isWithinTradingWindow(
  settings: Pick<
    UserSettings,
    | "tradingWindowEnabled"
    | "tradingStartHour"
    | "tradingEndHour"
    | "tradingTimezone"
  >,
  now = new Date(),
): TradingWindowStatus {
  if (!settings.tradingWindowEnabled) {
    return {
      allowed: true,
      currentHour: getHourInTimezone(settings.tradingTimezone, now),
      message: "Finestra oraria disabilitata.",
    };
  }

  const currentHour = getHourInTimezone(settings.tradingTimezone, now);
  const { tradingStartHour, tradingEndHour, tradingTimezone } = settings;
  const allowed =
    currentHour >= tradingStartHour && currentHour < tradingEndHour;

  return {
    allowed,
    currentHour,
    message: allowed
      ? `Trading consentito (${tradingStartHour}:00–${tradingEndHour}:00 ${tradingTimezone}).`
      : `Trading bloccato: fuori orario (${tradingStartHour}:00–${tradingEndHour}:00 ${tradingTimezone}, ora locale ${currentHour}:00).`,
  };
}
