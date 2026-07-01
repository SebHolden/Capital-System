import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMonthlyReport } from "@/lib/reports/monthly";
import { respondWithReport } from "@/lib/reports/respond";
import { isValidMonthKey } from "@/lib/reports/utils";
import { logError } from "@/lib/logger";

const querySchema = z.object({
  month: z
    .string()
    .optional()
    .refine((v) => !v || isValidMonthKey(v), {
      message: "month deve essere YYYY-MM",
    }),
  format: z.enum(["json", "csv"]).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      month: searchParams.get("month") ?? undefined,
      format: searchParams.get("format") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const report = await buildMonthlyReport(parsed.data.month);
    return respondWithReport(
      report,
      parsed.data.format ?? null,
      `monthly-report-${report.monthKey}`,
    );
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore nel report mensile.", code: "MONTHLY_REPORT_ERROR" },
      { status: 500 },
    );
  }
}
