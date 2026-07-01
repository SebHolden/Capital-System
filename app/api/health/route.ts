import { NextResponse } from "next/server";
import packageJson from "@/package.json";
import { prisma } from "@/lib/db";
import { getEffectiveExecutionMode } from "@/lib/deployment/validateEnv";
import { logError } from "@/lib/logger";
import { isLiveTradingEnabled } from "@/lib/security";

async function checkDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function resolveExecutionMode(): Promise<string> {
  const databaseReachable = await checkDatabaseReachable();
  if (!databaseReachable) {
    return getEffectiveExecutionMode();
  }

  try {
    const settings = await prisma.userSettings.findUnique({
      where: { id: "default" },
      select: { executionMode: true },
    });
    if (settings?.executionMode) {
      return settings.executionMode.toLowerCase();
    }
  } catch {
    // Fall back to env default below.
  }

  return getEffectiveExecutionMode();
}

export async function GET() {
  try {
    const databaseReachable = await checkDatabaseReachable();
    const executionMode = databaseReachable
      ? await resolveExecutionMode()
      : getEffectiveExecutionMode();

    return NextResponse.json({
      ok: databaseReachable,
      version: packageJson.version,
      executionMode,
      liveTradingEnabled: isLiveTradingEnabled(),
      databaseReachable,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError("Health check failed", error);
    return NextResponse.json(
      {
        ok: false,
        version: packageJson.version,
        executionMode: getEffectiveExecutionMode(),
        liveTradingEnabled: isLiveTradingEnabled(),
        databaseReachable: false,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
