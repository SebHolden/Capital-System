import type { UserSettings } from "@prisma/client";
import {
  checkKillSwitch,
  checkLiveOrderLimits,
  getDailyLiveVolume,
  getMonthlyLiveVolume,
  hasPromotedStrategy,
  isLiveTradingEnabled,
  verifyLivePassphrase,
} from "@/lib/security";

export class LiveNotEnabledError extends Error {
  constructor() {
    super("Live trading disabilitato: ENABLE_LIVE_TRADING non è true.");
    this.name = "LiveNotEnabledError";
  }
}

export class LivePassphraseError extends Error {
  constructor() {
    super("Passphrase live non valida.");
    this.name = "LivePassphraseError";
  }
}

export class LiveLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveLimitError";
  }
}

export class LivePrerequisiteError extends Error {
  constructor(
    message: string,
    public readonly reasons: string[],
  ) {
    super(message);
    this.name = "LivePrerequisiteError";
  }
}

export interface LiveGateInput {
  confirmLive?: boolean;
  livePassphrase?: string;
}

export async function assertLiveExecutionAllowed(
  input: LiveGateInput,
  settings: UserSettings,
  orderAmount: number,
): Promise<void> {
  if (!isLiveTradingEnabled()) {
    throw new LiveNotEnabledError();
  }

  const reasons: string[] = [];

  const killSwitch = checkKillSwitch(settings);
  if (killSwitch.blocked) {
    reasons.push(killSwitch.reason ?? "Kill switch attivo.");
  }

  const promoted = await hasPromotedStrategy();
  if (!promoted) {
    reasons.push("Nessuna strategia in stato PROMOTED.");
  }

  if (input.confirmLive !== true) {
    reasons.push("Conferma live obbligatoria (confirmLive: true).");
  }

  if (!verifyLivePassphrase(input.livePassphrase)) {
    throw new LivePassphraseError();
  }

  if (reasons.length > 0) {
    throw new LivePrerequisiteError(
      "Prerequisiti live non soddisfatti.",
      reasons,
    );
  }

  const dailyVolume = await getDailyLiveVolume();
  const monthlyVolume = await getMonthlyLiveVolume();
  const limits = checkLiveOrderLimits(
    settings,
    orderAmount,
    dailyVolume,
    monthlyVolume,
  );
  if (!limits.allowed) {
    throw new LiveLimitError(limits.reason ?? "Limite LIVE superato.");
  }
}
