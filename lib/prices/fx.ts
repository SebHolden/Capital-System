export interface FxRate {
  from: string;
  to: string;
  rate: number;
  source: string;
  capturedAt: Date;
}

let cachedUsdEur: FxRate | null = null;
const CACHE_MS = 60 * 60 * 1000;

function parseEnvRate(): number | null {
  const raw = process.env.EUR_USD_RATE?.trim();
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getFallbackUsdEurRate(): number {
  return parseEnvRate() ?? 0.92;
}

async function fetchUsdEurFromApi(): Promise<FxRate | null> {
  const provider = process.env.FX_PROVIDER?.trim() || "exchangerate.host";

  try {
    if (provider === "exchangerate.host") {
      const response = await fetch(
        "https://api.exchangerate.host/latest?base=USD&symbols=EUR",
        { next: { revalidate: 3600 } },
      );
      if (!response.ok) return null;
      const data = (await response.json()) as { rates?: { EUR?: number } };
      const rate = data.rates?.EUR;
      if (typeof rate !== "number" || rate <= 0) return null;
      return {
        from: "USD",
        to: "EUR",
        rate,
        source: "exchangerate.host",
        capturedAt: new Date(),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function getUsdToEurRate(): Promise<FxRate> {
  if (cachedUsdEur && Date.now() - cachedUsdEur.capturedAt.getTime() < CACHE_MS) {
    return cachedUsdEur;
  }

  const fetched = await fetchUsdEurFromApi();
  if (fetched) {
    cachedUsdEur = fetched;
    return fetched;
  }

  const fallbackRate = getFallbackUsdEurRate();
  cachedUsdEur = {
    from: "USD",
    to: "EUR",
    rate: fallbackRate,
    source: parseEnvRate() ? "env:EUR_USD_RATE" : "fallback",
    capturedAt: new Date(),
  };
  return cachedUsdEur;
}

export async function convertToEur(
  amount: number,
  currency: string,
): Promise<{ amountEur: number; fxRate?: FxRate; originalAmount: number; originalCurrency: string }> {
  const normalized = currency.toUpperCase();
  if (normalized === "EUR") {
    return {
      amountEur: amount,
      originalAmount: amount,
      originalCurrency: "EUR",
    };
  }

  if (normalized === "USD") {
    const fx = await getUsdToEurRate();
    return {
      amountEur: amount * fx.rate,
      fxRate: fx,
      originalAmount: amount,
      originalCurrency: "USD",
    };
  }

  return {
    amountEur: amount,
    originalAmount: amount,
    originalCurrency: normalized,
  };
}
