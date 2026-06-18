"use client";

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/security/csrf-constants";

let cachedToken: string | null = null;

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(CSRF_COOKIE_NAME.length + 1));
}

export async function getCsrfToken(): Promise<string> {
  const fromCookie = readCsrfCookie();
  if (fromCookie) {
    cachedToken = fromCookie;
    return fromCookie;
  }
  if (cachedToken) return cachedToken;

  const res = await fetch("/api/csrf");
  if (!res.ok) {
    throw new Error("Impossibile ottenere token CSRF.");
  }
  const data = (await res.json()) as { token: string };
  cachedToken = data.token;
  return data.token;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (method !== "GET" && method !== "HEAD") {
    const token = await getCsrfToken();
    headers.set(CSRF_HEADER_NAME, token);
  }

  return fetch(input, { ...init, headers });
}
