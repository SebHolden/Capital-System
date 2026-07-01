const REDACTED = "[REDACTED]";

const SENSITIVE_ENV_KEYS = [
  "APP_PASSWORD",
  "DATABASE_URL",
  "ENABLE_LIVE_TRADING",
  "BROKER_API_KEY",
  "BROKER_API_SECRET",
  "ALPACA_API_KEY",
  "ALPACA_API_SECRET",
  "ALPACA_PAPER_BASE_URL",
  "ALPACA_LIVE_BASE_URL",
  "FINNHUB_API_KEY",
  "LIVE_TRADING_PASSPHRASE",
  "COINBASE_API_KEY",
  "COINBASE_API_SECRET",
  "KRAKEN_API_KEY",
  "KRAKEN_API_SECRET",
] as const;

const SENSITIVE_FIELD_NAMES = new Set([
  "password",
  "livepassphrase",
  "authorization",
  "apikey",
  "apisecret",
  "brokerapikey",
  "brokerapisecret",
  "alpacaapikey",
  "alpacaapisecret",
  "databaseurl",
  "apppassword",
  "livetradingpassphrase",
  "finnhubapikey",
]);

function collectEnvSecrets(): string[] {
  const secrets: string[] = [];
  for (const key of SENSITIVE_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value && value.length >= 4) {
      secrets.push(value);
    }
  }
  return secrets;
}

function redactString(input: string, secrets: string[]): string {
  let result = input;

  for (const secret of secrets) {
    if (result.includes(secret)) {
      result = result.split(secret).join(REDACTED);
    }
  }

  result = result.replace(
    /(postgresql|mysql|mongodb)(\+srv)?:\/\/[^@\s]+@[^\s"']+/gi,
    `$1://***@${REDACTED}`,
  );
  result = result.replace(/file:\.\/[^\s"']+/gi, `file:${REDACTED}`);
  result = result.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, `Basic ${REDACTED}`);

  return result;
}

export function redact(value: unknown, secrets = collectEnvSecrets()): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return redactString(value, secrets);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message, secrets),
      stack: value.stack ? redactString(value.stack, secrets) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, secrets));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_FIELD_NAMES.has(key.toLowerCase())) {
        result[key] = REDACTED;
      } else {
        result[key] = redact(val, secrets);
      }
    }
    return result;
  }

  return value;
}

export function logWarn(message: string, meta?: Record<string, unknown>): void {
  if (meta && Object.keys(meta).length > 0) {
    console.warn(message, redact(meta));
  } else {
    console.warn(message);
  }
}

export function logError(
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
): void {
  const payload: Record<string, unknown> = { ...meta };
  if (error !== undefined) {
    payload.error = redact(error);
  }
  if (Object.keys(payload).length > 0) {
    console.error(message, redact(payload));
  } else {
    console.error(message);
  }
}
