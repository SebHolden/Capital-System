import { NextResponse } from "next/server";
import { simulateOrder } from "@/lib/execution";
import { simulateOrderSchema } from "@/lib/execution/schemas";
import { mapMutatingSecurityError, verifyMutatingRequest } from "@/lib/security";
import { logError } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    verifyMutatingRequest(request);
    const body = await request.json();
    const parsed = simulateOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const result = await simulateOrder(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore nella simulazione dell'ordine.", code: "SIMULATE_ERROR" },
      { status: 500 },
    );
  }
}
