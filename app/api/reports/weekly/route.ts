import { NextResponse } from "next/server";
import { z } from "zod";
import { respondWithReport } from "@/lib/reports/respond";
import { buildWeeklyReport } from "@/lib/reports/weekly";
import { isValidDateKey } from "@/lib/reports/utils";

const querySchema = z.object({
  start: z
    .string()
    .optional()
    .refine((v) => !v || isValidDateKey(v), {
      message: "start deve essere YYYY-MM-DD",
    }),
  format: z.enum(["json", "csv"]).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      start: searchParams.get("start") ?? undefined,
      format: searchParams.get("format") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const report = await buildWeeklyReport(parsed.data.start);
    return respondWithReport(
      report,
      parsed.data.format ?? null,
      `weekly-report-${report.weekStart}`,
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore nel report settimanale.", code: "WEEKLY_REPORT_ERROR" },
      { status: 500 },
    );
  }
}
