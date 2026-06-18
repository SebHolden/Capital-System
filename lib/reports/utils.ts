export function getDateKeyInTimezone(timezone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getMonthKeyInTimezone(timezone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function dayBoundsFromDateKey(dateKey: string): { since: Date; until: Date } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const since = new Date(year, month - 1, day, 0, 0, 0, 0);
  const until = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { since, until };
}

export function weekBoundsFromStart(weekStartKey: string): {
  since: Date;
  until: Date;
  weekEndKey: string;
} {
  const { since } = dayBoundsFromDateKey(weekStartKey);
  const until = new Date(since);
  until.setDate(until.getDate() + 6);
  until.setHours(23, 59, 59, 999);
  const weekEndKey = [
    until.getFullYear(),
    String(until.getMonth() + 1).padStart(2, "0"),
    String(until.getDate()).padStart(2, "0"),
  ].join("-");
  return { since, until, weekEndKey };
}

export function monthBoundsFromKey(monthKey: string): { since: Date; until: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const since = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const until = new Date(year, month, 0, 23, 59, 59, 999);
  return { since, until };
}

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}
