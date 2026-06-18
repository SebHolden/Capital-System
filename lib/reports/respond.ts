import { NextResponse } from "next/server";
import { reportToCsv, reportToJson } from "./export";
import type { AnyReport } from "./types";

export function respondWithReport(
  report: AnyReport,
  format: string | null,
  filename: string,
) {
  if (format === "csv") {
    return new NextResponse(reportToCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  if (format === "json") {
    return new NextResponse(reportToJson(report), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  }

  return NextResponse.json(report);
}
