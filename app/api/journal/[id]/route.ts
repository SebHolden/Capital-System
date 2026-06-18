import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { applyJournalScoring, scoreJournal } from "@/lib/journal";
import {
  mapMutatingSecurityError,
  verifyMutatingRequest,
  writeAuditLog,
} from "@/lib/security";

const updateJournalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  thesis: z.string().min(10).optional(),
  risks: z.string().min(10).optional(),
  invalidation: z.string().min(10).optional(),
  emotionalState: z.string().min(3).optional(),
  timeHorizon: z.string().min(3).optional(),
  maxAcceptableLoss: z.number().positive().optional(),
  exitRule: z.string().min(5).optional(),
  emotionScore: z.number().int().min(1).max(10).optional(),
  confidenceScore: z.number().int().min(1).max(10).optional(),
  planned: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    verifyMutatingRequest(request);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateJournalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const existing = await prisma.tradeJournal.findUniqueOrThrow({
      where: { id },
    });

    const merged = {
      title: parsed.data.title ?? existing.title,
      thesis: parsed.data.thesis ?? existing.thesis,
      risks: parsed.data.risks ?? existing.risks,
      invalidation: parsed.data.invalidation ?? existing.invalidation,
      emotionalState: parsed.data.emotionalState ?? existing.emotionalState,
      timeHorizon: parsed.data.timeHorizon ?? existing.timeHorizon,
      maxAcceptableLoss:
        parsed.data.maxAcceptableLoss ?? existing.maxAcceptableLoss,
      exitRule: parsed.data.exitRule ?? existing.exitRule,
      emotionScore: parsed.data.emotionScore ?? existing.emotionScore,
      confidenceScore:
        parsed.data.confidenceScore ?? existing.confidenceScore,
      planned: parsed.data.planned ?? existing.planned,
    };

    const scored = applyJournalScoring(merged);

    const journal = await prisma.tradeJournal.update({
      where: { id },
      data: scored,
    });

    const quality = scoreJournal(merged);

    await writeAuditLog("JOURNAL_UPDATED", "TradeJournal", {
      ...parsed.data,
      qualityLevel: quality.level,
    }, id);

    return NextResponse.json({ journal });
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    console.error(error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento del journal.", code: "JOURNAL_UPDATE_ERROR" },
      { status: 500 },
    );
  }
}
