import { NextResponse } from "next/server";
import { runDailyWorkflow } from "@/lib/autopilot";
import { logError } from "@/lib/logger";
import { mapMutatingSecurityError, verifyMutatingRequest } from "@/lib/security";

export async function POST(request: Request) {
  try {
    verifyMutatingRequest(request);

    const { brief, workflow } = await runDailyWorkflow();

    return NextResponse.json({
      brief,
      workflow,
      message:
        "Workflow giornaliero completato. Nessuna esecuzione live effettuata.",
    });
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;

    logError("Request failed", error);
    const message =
      error instanceof Error ? error.message : "Errore workflow autopilot.";
    return NextResponse.json(
      { error: message, code: "AUTOPILOT_RUN_ERROR" },
      { status: 500 },
    );
  }
}
