export class OriginError extends Error {
  constructor(message = "Origin non valida o mancante.") {
    super(message);
    this.name = "OriginError";
  }
}

function parseOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function parseRefererOrigin(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function originFromAppBaseUrl(): string | null {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
}

function originFromHost(host: string | null): string | null {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;
  if (trimmed.includes("://")) {
    try {
      return new URL(trimmed).origin;
    } catch {
      return null;
    }
  }
  const protocol =
    process.env.NODE_ENV === "production" ? "https" : "http";
  try {
    return new URL(`${protocol}://${trimmed}`).origin;
  } catch {
    return null;
  }
}

function resolveExpectedOrigin(request: Request): string | null {
  return (
    originFromAppBaseUrl() ?? originFromHost(request.headers.get("host"))
  );
}

function requestOrigin(request: Request): string | null {
  return (
    parseOrigin(request.headers.get("origin")) ??
    parseRefererOrigin(request.headers.get("referer"))
  );
}

function hostMatchesExpected(request: Request, expected: string): boolean {
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    const expectedHost = new URL(expected).host;
    return host.toLowerCase() === expectedHost.toLowerCase();
  } catch {
    return false;
  }
}

export function verifyRequestOrigin(request: Request): void {
  const expected = resolveExpectedOrigin(request);

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      throw new OriginError(
        "Impossibile validare Origin: APP_BASE_URL o Host non configurati.",
      );
    }
    return;
  }

  const origin = requestOrigin(request);

  if (process.env.NODE_ENV === "production") {
    if (!origin) {
      throw new OriginError("Header Origin obbligatorio in produzione.");
    }
    if (origin !== expected) {
      throw new OriginError("Origin non autorizzata.");
    }
    if (!hostMatchesExpected(request, expected)) {
      throw new OriginError("Host header non coerente con l'origine attesa.");
    }
    return;
  }

  if (!origin) {
    if (process.env.APP_BASE_URL?.trim()) {
      console.warn(
        "[origin] Richiesta mutante senza Origin in development; APP_BASE_URL è impostato.",
      );
    }
    return;
  }

  if (origin !== expected) {
    throw new OriginError("Origin non autorizzata.");
  }
}
