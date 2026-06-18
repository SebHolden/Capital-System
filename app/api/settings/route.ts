import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getUserSettings,
  isLiveTradingEnabled,
  writeAuditLog,
  mapMutatingSecurityError,
  verifyMutatingRequest,
} from "@/lib/security";

const updateSettingsSchema = z
  .object({
    hypotheticalCapital: z.number().positive().optional(),
    cashBalance: z.number().min(0).optional(),
    executionMode: z.enum(["MOCK", "PAPER", "LIVE"]).optional(),
    killSwitchActive: z.boolean().optional(),
    maxPositionPct: z.number().min(1).max(100).optional(),
    maxBucketPct: z.number().min(1).max(100).optional(),
    maxDailyOrders: z.number().int().min(1).max(50).optional(),
    maxOrderAmount: z.number().positive().optional(),
    maxLiveOrderAmount: z.number().positive().optional(),
    maxDailyLiveAmount: z.number().positive().optional(),
    maxMonthlyLiveAmount: z.number().positive().optional(),
    minCashReserve: z.number().min(0).optional(),
    maxCryptoPct: z.number().min(1).max(100).optional(),
    maxDailyLossPct: z.number().min(0.1).max(100).optional(),
    maxMonthlyLossPct: z.number().min(0.1).max(100).optional(),
    maxExperimentalPct: z.number().min(0.1).max(100).optional(),
    maxDrawdownPct: z.number().min(0.1).max(100).optional(),
    maxSingleCryptoPct: z.number().min(0.1).max(100).optional(),
    leverageAllowed: z.boolean().optional(),
    maxAssetPumpPct: z.number().min(1).max(100).optional(),
    assetPumpLookbackDays: z.number().int().min(1).max(90).optional(),
    maxAssetVolatilityPct: z.number().min(1).max(200).optional(),
    revengeTradingLossPct: z.number().min(0.1).max(20).optional(),
    experimentalCapital: z.number().min(0).optional(),
    experimentalCashBalance: z.number().min(0).optional(),
    rejectedOrderCooldownMinutes: z.number().int().min(0).max(120).optional(),
    rejectAveragingDown: z.boolean().optional(),
    tradingWindowEnabled: z.boolean().optional(),
    tradingStartHour: z.number().int().min(0).max(23).optional(),
    tradingEndHour: z.number().int().min(1).max(24).optional(),
    tradingTimezone: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      if (
        data.tradingStartHour !== undefined &&
        data.tradingEndHour !== undefined
      ) {
        return data.tradingStartHour < data.tradingEndHour;
      }
      return true;
    },
    {
      message: "tradingStartHour deve essere minore di tradingEndHour",
      path: ["tradingStartHour"],
    },
  );

export async function GET() {
  try {
    const settings = await getUserSettings();
    return NextResponse.json({
      settings,
      liveTradingEnabled: isLiveTradingEnabled(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore nel recupero delle impostazioni.", code: "SETTINGS_FETCH_ERROR" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    verifyMutatingRequest(request);
    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    if (parsed.data.executionMode === "LIVE" && !isLiveTradingEnabled()) {
      return NextResponse.json(
        {
          error: "Impossibile attivare LIVE: ENABLE_LIVE_TRADING non è true.",
          code: "LIVE_NOT_ENABLED",
        },
        { status: 403 },
      );
    }

    const settings = await prisma.userSettings.update({
      where: { id: "default" },
      data: parsed.data,
    });

    await writeAuditLog("SETTINGS_UPDATED", "UserSettings", parsed.data, settings.id);

    return NextResponse.json({
      settings,
      liveTradingEnabled: isLiveTradingEnabled(),
    });
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    console.error(error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento delle impostazioni.", code: "SETTINGS_UPDATE_ERROR" },
      { status: 500 },
    );
  }
}
