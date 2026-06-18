import type { AssetType, Bucket } from "@prisma/client";
import { z } from "zod";

const bucketValues = [
  "CASH",
  "CORE",
  "GROWTH",
  "SPECULATIVE",
  "HEDGE",
] as const;

export const csvRowSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().optional(),
  quantity: z.number().positive(),
  avgPrice: z.number().positive(),
  bucket: z.enum(bucketValues).optional(),
  assetType: z
    .enum(["ETF", "STOCK", "BOND", "CRYPTO", "OTHER"])
    .optional(),
});

export type CsvImportRow = z.infer<typeof csvRowSchema>;

export interface CsvImportPreview {
  rows: CsvImportRow[];
  errors: Array<{ line: number; message: string }>;
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

export function parsePortfolioCsv(csvText: string): CsvImportPreview {
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
  const qtyIdx = headerCells.findIndex((h) =>
    ["quantity", "qty", "quantita", "quantità"].includes(h),
  );
  const priceIdx = headerCells.findIndex((h) =>
    ["avgprice", "average_price", "prezzo_medio", "price", "prezzo"].includes(h),
  );
  const nameIdx = headerCells.findIndex((h) =>
    ["name", "nome", "description"].includes(h),
  );
  const bucketIdx = headerCells.findIndex((h) => ["bucket"].includes(h));
  const typeIdx = headerCells.findIndex((h) =>
    ["assettype", "type", "tipo"].includes(h),
  );

  if (symbolIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message:
            "Header obbligatorio: symbol, quantity, avgPrice (o alias supportati).",
        },
      ],
    };
  }

  const rows: CsvImportRow[] = [];
  const errors: CsvImportPreview["errors"] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const lineNo = i + 1;

    const raw = {
      symbol: cells[symbolIdx]?.toUpperCase() ?? "",
      name: nameIdx >= 0 ? cells[nameIdx] : undefined,
      quantity: Number.parseFloat(cells[qtyIdx]?.replace(",", ".") ?? ""),
      avgPrice: Number.parseFloat(cells[priceIdx]?.replace(",", ".") ?? ""),
      bucket: bucketIdx >= 0 ? cells[bucketIdx]?.toUpperCase() : undefined,
      assetType: typeIdx >= 0 ? cells[typeIdx]?.toUpperCase() : undefined,
    };

    const parsed = csvRowSchema.safeParse({
      ...raw,
      bucket: raw.bucket || "CORE",
      assetType: raw.assetType || "ETF",
    });

    if (!parsed.success) {
      errors.push({
        line: lineNo,
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
      continue;
    }

    rows.push(parsed.data);
  }

  return { rows, errors };
}

export async function commitCsvImport(
  rows: CsvImportRow[],
  createPosition: (
    data: {
      symbol: string;
      name: string;
      assetType: AssetType;
      bucket: Bucket;
      quantity: number;
      avgPrice: number;
    },
  ) => Promise<unknown>,
): Promise<{ imported: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      await createPosition({
        symbol: row.symbol,
        name: row.name ?? row.symbol,
        assetType: (row.assetType ?? "ETF") as AssetType,
        bucket: (row.bucket ?? "CORE") as Bucket,
        quantity: row.quantity,
        avgPrice: row.avgPrice,
      });
      imported++;
    } catch (error) {
      errors.push(
        `${row.symbol}: ${error instanceof Error ? error.message : "errore"}`,
      );
    }
  }

  return { imported, errors };
}
