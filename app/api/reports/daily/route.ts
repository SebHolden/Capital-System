import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDailyReport } from "@/lib/reports/daily";
import { respondWithReport } from "@/lib/reports/respond";
import { isValidDateKey } from "@/lib/reports/utils";
import { logError } from "@/lib/logger";

const querySchema = z.object({
  date: z
    .string()
    .optional()
    .refine((v) => !v || isValidDateKey(v), {
      message: "date deve essere YYYY-MM-DD",
    }),
  format: z.enum(["json", "csv"]).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      date: searchParams.get("date") ?? undefined,
      format: searchParams.get("format") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const report = await buildDailyReport(parsed.data.date);
    return respondWithReport(
      report,
      parsed.data.format ?? null,
      `daily-report-${report.date}`,
    );
  } catch (error) {
    logError("Request failed", error);
    return NextResponse.json(
      { error: "Errore nel report giornaliero.", code: "DAILY_REPORT_ERROR" },
      { status: 500 },
    );
  }
}
