import { NextResponse } from "next/server";
import { z } from "zod";
import { listExecutionLogs } from "@/lib/execution/logs";

const querySchema = z.object({
  mode: z.enum(["MOCK", "PAPER", "LIVE"]).optional(),
  status: z.enum(["FILLED", "REJECTED", "PARTIAL"]).optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      mode: url.searchParams.get("mode") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      since: url.searchParams.get("since") ?? undefined,
      until: url.searchParams.get("until") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const since = parsed.data.since ? new Date(parsed.data.since) : undefined;
    const until = parsed.data.until ? new Date(parsed.data.until) : undefined;

    const logs = await listExecutionLogs({
      mode: parsed.data.mode,
      status: parsed.data.status,
      since: since && !Number.isNaN(since.getTime()) ? since : undefined,
      until: until && !Number.isNaN(until.getTime()) ? until : undefined,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Errore nel recupero log esecuzione.", code: "EXECUTION_LOGS_ERROR" },
      { status: 500 },
    );
  }
}
