import type { AnyReport } from "./types";

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function flattenObject(
  obj: unknown,
  prefix = "",
  rows: Array<[string, string]> = [],
): Array<[string, string]> {
  if (obj === null || obj === undefined) {
    rows.push([prefix, ""]);
    return rows;
  }

  if (Array.isArray(obj)) {
    rows.push([prefix, JSON.stringify(obj)]);
    return rows;
  }

  if (typeof obj === "object" && !(obj instanceof Date)) {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      flattenObject(value, path, rows);
    }
    return rows;
  }

  rows.push([prefix, String(obj)]);
  return rows;
}

export function reportToJson(report: AnyReport): string {
  return JSON.stringify(report, null, 2);
}

export function reportToCsv(report: AnyReport): string {
  const rows = flattenObject(report);
  const lines = ["key,value", ...rows.map(([k, v]) => `${escapeCsv(k)},${escapeCsv(v)}`)];
  return lines.join("\n");
}
