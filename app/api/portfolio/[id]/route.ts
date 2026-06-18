import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePosition, updatePosition } from "@/lib/portfolio";
import { writeAuditLog, mapMutatingSecurityError, verifyMutatingRequest } from "@/lib/security";

const updatePositionSchema = z.object({
  quantity: z.number().positive().optional(),
  avgPrice: z.number().positive().optional(),
  bucket: z.enum(["CORE", "GROWTH", "SPECULATIVE", "HEDGE", "CASH"]).optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    verifyMutatingRequest(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = updatePositionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const position = await updatePosition(id, parsed.data);
    await writeAuditLog("POSITION_UPDATED", "Position", parsed.data, id);

    return NextResponse.json({ position });
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    console.error(error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento della posizione.", code: "POSITION_UPDATE_ERROR" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    verifyMutatingRequest(request);
    const { id } = await params;
    await deletePosition(id);
    await writeAuditLog("POSITION_DELETED", "Position", {}, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    console.error(error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione della posizione.", code: "POSITION_DELETE_ERROR" },
      { status: 500 },
    );
  }
}
