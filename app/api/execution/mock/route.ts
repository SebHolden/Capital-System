import { NextResponse } from "next/server";
import {
  executeOrder,
  LiveNotEnabledError,
  LivePassphraseError,
  LiveLimitError,
  LivePrerequisiteError,
} from "@/lib/execution";
import { IdempotencyKeyError } from "@/lib/execution/idempotency";
import { ExecutionRateLimitError } from "@/lib/execution/rateLimit";
import { executeOrderSchema } from "@/lib/execution/schemas";

import { mapMutatingSecurityError, verifyMutatingRequest } from "@/lib/security";
import { logError } from "@/lib/logger";

/** @deprecated Usa POST /api/execution — wrapper legacy per compatibilità MOCK. */
export async function POST(request: Request) {
  try {
    verifyMutatingRequest(request);
    const body = await request.json();
    const parsed = executeOrderSchema.safeParse({
      ...body,
      confirmRisk: body.confirmRisk ?? true,
      idempotencyKey:
        body.idempotencyKey ??
        `legacy_mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      mode: "MOCK",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const result = await executeOrder(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ExecutionRateLimitError) {
      return NextResponse.json(
        { error: error.message, code: "RATE_LIMIT_EXCEEDED" },
        { status: 429 },
      );
    }

    if (error instanceof IdempotencyKeyError) {
      return NextResponse.json(
        { error: error.message, code: "IDEMPOTENCY_KEY_INVALID" },
        { status: 400 },
      );
    }

    if (error instanceof LivePassphraseError) {
      return NextResponse.json(
        { error: error.message, code: "LIVE_PASSPHRASE_INVALID" },
        { status: 401 },
      );
    }

    if (error instanceof LiveNotEnabledError) {
      return NextResponse.json(
        { error: error.message, code: "LIVE_NOT_ENABLED" },
        { status: 403 },
      );
    }

    if (error instanceof LivePrerequisiteError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "LIVE_PREREQUISITE_FAILED",
          reasons: error.reasons,
        },
        { status: 403 },
      );
    }

    if (error instanceof LiveLimitError) {
      return NextResponse.json(
        { error: error.message, code: "LIVE_LIMIT_EXCEEDED" },
        { status: 429 },
      );
    }

    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;

    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore nell'esecuzione mock.", code: "MOCK_EXECUTION_ERROR" },
      { status: 500 },
    );
  }
}
