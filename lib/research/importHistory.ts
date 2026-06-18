import { prisma } from "@/lib/db";
import { z } from "zod";

export const historyRowSchema = z.object({
  symbol: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  close: z.number().positive(),
});

export type HistoryImportRow = z.infer<typeof historyRowSchema>;

export interface HistoryImportPreview {
  rows: HistoryImportRow[];
  errors: Array<{ line: number; message: string }>;
  defaultSymbol?: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, "_");
}

export function parseHistoryCsv(csvText: string): HistoryImportPreview {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, message: "File CSV vuoto." }] };
  }

  const headerCells = parseCsvLine(lines[0]).map(normalizeHeader);
  const symbolIdx = headerCells.findIndex((h) =>
    ["symbol", "ticker", "simbolo"].includes(h),
  );
  const dateIdx = headerCells.findIndex((h) =>
    ["date", "data", "pricedate", "price_date"].includes(h),
  );
  const closeIdx = headerCells.findIndex((h) =>
    ["close", "price", "prezzo", "chiusura"].includes(h),
  );

  const hasHeader =
    dateIdx >= 0 ||
    closeIdx >= 0 ||
    headerCells.some((h) => ["date", "close", "symbol"].includes(h));

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: HistoryImportRow[] = [];
  const errors: HistoryImportPreview["errors"] = [];

  const startLine = hasHeader ? 2 : 1;

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = startLine + i;
    const cells = parseCsvLine(dataLines[i]);

    let symbol: string | undefined;
    let date: string;
    let close: number;

    if (hasHeader && dateIdx >= 0 && closeIdx >= 0) {
      symbol = symbolIdx >= 0 ? cells[symbolIdx]?.toUpperCase() : undefined;
      date = cells[dateIdx];
      close = parseFloat(cells[closeIdx]);
    } else if (cells.length >= 2) {
      date = cells[0];
      close = parseFloat(cells[1]);
      symbol = cells.length >= 3 ? cells[2].toUpperCase() : undefined;
    } else {
      errors.push({ line: lineNum, message: "Riga non valida." });
      continue;
    }

    const parsed = historyRowSchema.safeParse({ symbol, date, close });
    if (!parsed.success) {
      errors.push({
        line: lineNum,
        message: parsed.error.issues[0]?.message ?? "Riga non valida.",
      });
      continue;
    }
    rows.push(parsed.data);
  }

  return { rows, errors };
}

export async function commitHistoryImport(
  rows: HistoryImportRow[],
  defaultSymbol: string,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  const bySymbol = new Map<string, HistoryImportRow[]>();
  for (const row of rows) {
    const sym = (row.symbol ?? defaultSymbol).toUpperCase();
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push(row);
  }

  for (const [symbol, symbolRows] of bySymbol) {
    const asset = await prisma.asset.findUnique({ where: { symbol } });
    if (!asset) {
      errors.push(`Asset non trovato: ${symbol}`);
      skipped += symbolRows.length;
      continue;
    }

    for (const row of symbolRows) {
      try {
        await prisma.historicalPrice.upsert({
          where: {
            assetId_priceDate: {
              assetId: asset.id,
              priceDate: row.date,
            },
          },
          update: { close: row.close, source: "import" },
          create: {
            assetId: asset.id,
            priceDate: row.date,
            close: row.close,
            source: "import",
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }
  }

  return { imported, skipped, errors };
}
