import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function unauthorized(): NextResponse {
  return new NextResponse("Autenticazione richiesta.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Seb Capital System"',
    },
  });
}

function safePasswordEqual(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  const password = process.env.APP_PASSWORD?.trim();
  if (!password) {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) {
    return unauthorized();
  }

  const encoded = auth.slice(6);
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }

  const colon = decoded.indexOf(":");
  const providedPassword =
    colon >= 0 ? decoded.slice(colon + 1) : decoded;

  if (!safePasswordEqual(providedPassword, password)) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
