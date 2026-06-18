import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { applyJournalScoring } from "@/lib/journal";
import { mapMutatingSecurityError, verifyMutatingRequest, writeAuditLog } from "@/lib/security";
const journalFieldsSchema = {
  title: z.string().min(1).max(200),
  thesis: z.string().min(10),
  risks: z.string().min(10),
  invalidation: z.string().min(10),
  emotionalState: z.string().min(3),
  timeHorizon: z.string().min(3),
  maxAcceptableLoss: z.number().positive(),
  exitRule: z.string().min(5),
  emotionScore: z.number().int().min(1).max(10),
  confidenceScore: z.number().int().min(1).max(10),
  planned: z.boolean(),
};

const createJournalSchema = z.object(journalFieldsSchema);

export async function GET() {
  try {
    const journals = await prisma.tradeJournal.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ journals });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore nel recupero dei journal.", code: "JOURNAL_FETCH_ERROR" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    verifyMutatingRequest(request);
    const body = await request.json();
    const parsed = createJournalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const scored = applyJournalScoring(parsed.data);

    const journal = await prisma.tradeJournal.create({
      data: scored,
    });

    await writeAuditLog("JOURNAL_CREATED", "TradeJournal", parsed.data, journal.id);

    return NextResponse.json({ journal }, { status: 201 });
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    console.error(error);
    return NextResponse.json(
      { error: "Errore nella creazione del journal.", code: "JOURNAL_CREATE_ERROR" },
      { status: 500 },
    );
  }
}
