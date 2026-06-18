import { randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf-constants";

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf-constants";

export class CsrfError extends Error {
  constructor(message = "Token CSRF non valido o mancante.") {
    super(message);
    this.name = "CsrfError";
  }
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyCsrfToken(headerToken: string | null, cookieToken: string | undefined): void {
  if (!headerToken || !cookieToken) {
    throw new CsrfError();
  }
  if (!safeEqual(headerToken, cookieToken)) {
    throw new CsrfError();
  }
}

export function verifyCsrfRequest(request: Request): void {
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieToken = parseCookieHeader(request.headers.get("cookie")).get(
    CSRF_COOKIE_NAME,
  );
  verifyCsrfToken(headerToken, cookieToken);
}

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) continue;
    map.set(rawKey, decodeURIComponent(rest.join("=")));
  }
  return map;
}

export function csrfCookieOptions(token: string) {
  return {
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: false,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}

export async function issueCsrfToken(): Promise<{ token: string; response: NextResponse }> {
  const token = generateCsrfToken();
  const cookieStore = await cookies();
  cookieStore.set(csrfCookieOptions(token));
  return {
    token,
    response: NextResponse.json({ token }),
  };
}
