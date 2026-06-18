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

export function middleware(request: NextRequest) {
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

  if (providedPassword !== password) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
