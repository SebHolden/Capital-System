import { NextResponse } from "next/server";
import { z } from "zod";
import { createPosition } from "@/lib/portfolio";
import {
  commitCsvImport,
  csvRowSchema,
  parsePortfolioCsv,
} from "@/lib/portfolio/import";
import { mapMutatingSecurityError, verifyMutatingRequest, writeAuditLog } from "@/lib/security";

const previewSchema = z.object({
  action: z.literal("preview"),
  csv: z.string().min(1),
});

const commitSchema = z.object({
  action: z.literal("commit"),
  rows: z.array(csvRowSchema).min(1),
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
      const preview = parsePortfolioCsv(parsed.data.csv);
      return NextResponse.json(preview);
    }

    const result = await commitCsvImport(parsed.data.rows, (data) =>
      createPosition({
        symbol: data.symbol,
        name: data.name ?? data.symbol,
        assetType: data.assetType as "ETF" | "STOCK" | "BOND" | "CRYPTO" | "OTHER",
        bucket: data.bucket ?? "CORE",
        quantity: data.quantity,
        avgPrice: data.avgPrice,
      }),
    );

    await writeAuditLog("PORTFOLIO_CSV_IMPORT", "Position", {
      imported: result.imported,
      errors: result.errors,
    });

    return NextResponse.json(result);
  } catch (error) {
    const securityError = mapMutatingSecurityError(error);
    if (securityError) return securityError;
    console.error(error);
    return NextResponse.json(
      { error: "Errore import CSV.", code: "IMPORT_ERROR" },
      { status: 500 },
    );
  }
}
