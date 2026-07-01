import { NextResponse } from "next/server";
import { z } from "zod";
import { refreshPrices } from "@/lib/prices";
import { writeAuditLog, mapMutatingSecurityError, verifyMutatingRequest } from "@/lib/security";
import { logError } from "@/lib/logger";

const bodySchema = z.object({
  assetIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    verifyMutatingRequest(request);
    const url = new URL(request.url);
    const assetIdParam = url.searchParams.get("assetId");

    let assetIds: string[] | undefined;
    if (assetIdParam) {
      assetIds = [assetIdParam];
    } else {
      try {
        const body = await request.json();
        const parsed = bodySchema.safeParse(body);
        if (parsed.success && parsed.data.assetIds) {
          assetIds = parsed.data.assetIds;
        }
      } catch {
        // empty body is fine — refresh all
      }
    }

    const result = await refreshPrices(assetIds);
    await writeAuditLog("PRICES_REFRESHED", "PriceSnapshot", {
      refreshed: result.refreshed,
      failed: result.failed,
      assetIds,
    });

    return NextResponse.json(result);
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore nel refresh prezzi.", code: "PRICES_REFRESH_ERROR" },
      { status: 500 },
    );
  }
}
