import { NextResponse } from "next/server";
import { z } from "zod";
import {
  commitHistoryImport,
  historyRowSchema,
  parseHistoryCsv,
} from "@/lib/research/importHistory";
import { CsrfError, verifyMutatingRequest, writeAuditLog } from "@/lib/security";
import { logError } from "@/lib/logger";

const previewSchema = z.object({
  action: z.literal("preview"),
  csv: z.string().min(1),
  defaultSymbol: z.string().min(1).optional(),
});

const commitSchema = z.object({
  action: z.literal("commit"),
  defaultSymbol: z.string().min(1),
  rows: z.array(historyRowSchema).min(1),
});

const bodySchema = z.discriminatedUnion("action", [previewSchema, commitSchema]);

export async function POST(request: Request) {
  try {
    verifyMutatingRequest(request);
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    if (parsed.data.action === "preview") {
      const preview = parseHistoryCsv(parsed.data.csv);
      return NextResponse.json({
        ...preview,
        defaultSymbol: parsed.data.defaultSymbol,
      });
    }

    const result = await commitHistoryImport(
      parsed.data.rows,
      parsed.data.defaultSymbol.toUpperCase(),
    );

    await writeAuditLog("RESEARCH_HISTORY_IMPORT", "HistoricalPrice", {
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      defaultSymbol: parsed.data.defaultSymbol,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: error.message, code: "CSRF_INVALID" },
        { status: 403 },
      );
    }
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore import storico.", code: "IMPORT_ERROR" },
      { status: 500 },
    );
  }
}
