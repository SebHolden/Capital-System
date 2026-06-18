import { NextResponse } from "next/server";
import { z } from "zod";
import { syncBrokerAccountSnapshot } from "@/lib/brokers/alpaca-account";
import { CsrfError, verifyCsrfRequest, writeAuditLog } from "@/lib/security";

const bodySchema = z.object({
  mode: z.enum(["PAPER", "LIVE"]).default("PAPER"),
});

export async function POST(request: Request) {
  try {
    verifyCsrfRequest(request);
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const snapshot = await syncBrokerAccountSnapshot(parsed.data.mode);
    await writeAuditLog(
      "BROKER_SNAPSHOT_SYNC",
      "BrokerAccountSnapshot",
      { mode: parsed.data.mode, equity: snapshot.equity },
      snapshot.id,
    );

    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: error.message, code: "CSRF_ERROR" },
        { status: 403 },
      );
    }
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Errore nella sincronizzazione broker.",
        code: "BROKER_SYNC_ERROR",
      },
      { status: 500 },
    );
  }
}
