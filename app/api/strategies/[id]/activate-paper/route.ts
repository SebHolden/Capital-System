import { NextResponse } from "next/server";
import {
  activatePaperStrategy,
  PaperActivationError,
} from "@/lib/paper-signals";
import { activatePaperSchema } from "@/lib/paper-signals/schemas";
import { CsrfError, verifyCsrfRequest } from "@/lib/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    verifyCsrfRequest(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = activatePaperSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const strategy = await activatePaperStrategy(
      id,
      parsed.data.primaryAssetId,
    );

    return NextResponse.json({ strategy });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: error.message, code: "CSRF_ERROR" },
        { status: 403 },
      );
    }
    if (error instanceof PaperActivationError) {
      return NextResponse.json(
        { error: error.message, reasons: error.reasons, code: "PAPER_ACTIVATION_DENIED" },
        { status: 400 },
      );
    }

    console.error(error);
    return NextResponse.json(
      { error: "Errore attivazione paper.", code: "PAPER_ACTIVATION_ERROR" },
      { status: 500 },
    );
  }
}
