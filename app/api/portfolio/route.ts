import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPosition,
  getPortfolioSummary,
  getPositionsWithAssets,
} from "@/lib/portfolio";
import { writeAuditLog, CsrfError, verifyCsrfRequest } from "@/lib/security";

const createPositionSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  assetType: z.enum(["ETF", "STOCK", "BOND", "CRYPTO", "OTHER"]).default("ETF"),
  bucket: z.enum(["CORE", "GROWTH", "SPECULATIVE", "HEDGE", "CASH"]),
  quantity: z.number().positive(),
  avgPrice: z.number().positive(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const [summary, positions] = await Promise.all([
      getPortfolioSummary(),
      getPositionsWithAssets(),
    ]);

    return NextResponse.json({ summary, positions });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore nel recupero del portafoglio.", code: "PORTFOLIO_FETCH_ERROR" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    verifyCsrfRequest(request);
    const body = await request.json();
    const parsed = createPositionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const position = await createPosition(parsed.data);
    await writeAuditLog("POSITION_CREATED", "Position", parsed.data, position.id);

    return NextResponse.json({ position }, { status: 201 });
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: error.message, code: "CSRF_ERROR" },
        { status: 403 },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: "Errore nella creazione della posizione.", code: "POSITION_CREATE_ERROR" },
      { status: 500 },
    );
  }
}
