import { prisma } from "@/lib/db";

const WINDOW_MS = 60_000;

export class ExecutionRateLimitError extends Error {
  constructor(
    public readonly limit: number,
    public readonly retryAfterSeconds: number,
  ) {
    super(`Rate limit esecuzione superato: max ${limit} ordini al minuto.`);
    this.name = "ExecutionRateLimitError";
  }
}

function getExecutionRateLimit(): number {
  const raw = process.env.EXECUTION_RATE_LIMIT_PER_MIN;
  const parsed = raw ? parseInt(raw, 10) : 10;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

export async function checkExecutionRateLimit(): Promise<void> {
  const limit = getExecutionRateLimit();
  const since = new Date(Date.now() - WINDOW_MS);

  const recentCount = await prisma.orderIntent.count({
    where: {
      status: "EXECUTED",
      createdAt: { gte: since },
    },
  });

  if (recentCount >= limit) {
    throw new ExecutionRateLimitError(limit, 60);
  }
}
