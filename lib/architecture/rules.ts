export interface ArchitectureRule {
  id: string;
  description: string;
  pattern: RegExp;
}

export interface RuleSet {
  id: string;
  pathPrefix: string;
  rules: ArchitectureRule[];
}

const FORBIDDEN_LAYER_IMPORTS: ArchitectureRule[] = [
  {
    id: "import-brokers",
    description: "must not import @/lib/brokers or relative brokers path",
    pattern:
      /(?:from\s+["']@\/lib\/brokers|from\s+["'][./]+(?:\.\.\/)*brokers)/,
  },
  {
    id: "import-execution",
    description: "must not import @/lib/execution or relative execution path",
    pattern:
      /(?:from\s+["']@\/lib\/execution|from\s+["'][./]+(?:\.\.\/)*execution)/,
  },
  {
    id: "import-security-live",
    description: "must not import @/lib/security/live",
    pattern:
      /(?:from\s+["']@\/lib\/security\/live|from\s+["'][./]+(?:\.\.\/)*security\/live)/,
  },
];

const BROKER_SDK_PATTERNS: ArchitectureRule[] = [
  {
    id: "sdk-alpaca",
    description: "must not reference Alpaca SDK or client",
    pattern: /(?:@alpacahq\/|alpaca-?trade|AlpacaLiveBroker)/i,
  },
  {
    id: "sdk-coinbase",
    description: "must not reference Coinbase SDK",
    pattern: /(?:coinbase-pro|coinbase-advanced|CoinbaseBroker)/i,
  },
  {
    id: "sdk-kraken",
    description: "must not reference Kraken SDK",
    pattern: /(?:kraken-api|KrakenBroker)/i,
  },
  {
    id: "sdk-ib",
    description: "must not reference Interactive Brokers SDK",
    pattern: /(?:interactive-brokers|ib_insync|IBGateway)/i,
  },
  {
    id: "sdk-ccxt",
    description: "must not reference CCXT exchange library",
    pattern: /\bccxt\b/i,
  },
];

const BACKTEST_ORDER_PATTERNS: ArchitectureRule[] = [
  {
    id: "order-intent-create",
    description: "must not create OrderIntent records",
    pattern: /(?:orderIntent\.create|prisma\.orderIntent\.create)/,
  },
  {
    id: "execution-log-create",
    description: "must not create ExecutionLog records",
    pattern: /(?:executionLog\.create|prisma\.executionLog\.create)/,
  },
  {
    id: "broker-order-id",
    description: "must not assign broker order IDs",
    pattern: /brokerOrderId\s*[:=]/,
  },
];

const PAPER_SIGNAL_PATTERNS: ArchitectureRule[] = [
  {
    id: "call-execute-order",
    description: "must not call executeOrder",
    pattern: /\bexecuteOrder\s*\(/,
  },
  {
    id: "call-get-broker",
    description: "must not call getBroker",
    pattern: /\bgetBroker\s*\(/,
  },
  {
    id: "ref-live-broker",
    description: "must not reference LiveBroker",
    pattern: /\bLiveBroker\b/,
  },
  {
    id: "ref-alpaca-live-broker",
    description: "must not reference AlpacaLiveBroker",
    pattern: /\bAlpacaLiveBroker\b/,
  },
];

const PYTHON_FORBIDDEN_PATTERNS: ArchitectureRule[] = [
  {
    id: "py-alpaca-key",
    description: "Python must not contain ALPACA_API_KEY",
    pattern: /ALPACA_API_KEY/,
  },
  {
    id: "py-alpaca-secret",
    description: "Python must not contain ALPACA_API_SECRET",
    pattern: /ALPACA_API_SECRET/,
  },
  {
    id: "py-live-passphrase",
    description: "Python must not contain LIVE_TRADING_PASSPHRASE",
    pattern: /LIVE_TRADING_PASSPHRASE/,
  },
  {
    id: "py-enable-live",
    description: "Python must not contain ENABLE_LIVE_TRADING",
    pattern: /ENABLE_LIVE_TRADING/,
  },
  {
    id: "py-place-order",
    description: "Python must not call place_order",
    pattern: /\bplace_order\b/,
  },
  {
    id: "py-submit-order",
    description: "Python must not call submit_order",
    pattern: /\bsubmit_order\b/,
  },
  {
    id: "py-create-order",
    description: "Python must not call create_order",
    pattern: /\bcreate_order\b/,
  },
];

export const STRATEGY_RULE_SET: RuleSet = {
  id: "strategies",
  pathPrefix: "lib/strategies/",
  rules: [...FORBIDDEN_LAYER_IMPORTS, ...BROKER_SDK_PATTERNS],
};

export const BACKTESTING_RULE_SET: RuleSet = {
  id: "backtesting",
  pathPrefix: "lib/backtesting/",
  rules: [...FORBIDDEN_LAYER_IMPORTS, ...BACKTEST_ORDER_PATTERNS],
};

export const PAPER_SIGNALS_RULE_SET: RuleSet = {
  id: "paper-signals",
  pathPrefix: "lib/paper-signals/",
  rules: PAPER_SIGNAL_PATTERNS,
};

export const PYTHON_RULE_SET: RuleSet = {
  id: "python",
  pathPrefix: "",
  rules: PYTHON_FORBIDDEN_PATTERNS,
};

export const RULE_SETS: RuleSet[] = [
  STRATEGY_RULE_SET,
  BACKTESTING_RULE_SET,
  PAPER_SIGNALS_RULE_SET,
];

export const MUTATING_HANDLER_PATTERN =
  /export\s+async\s+function\s+(?:POST|PATCH|DELETE|PUT)\b/;

export const VERIFY_MUTATING_REQUEST_PATTERN = /verifyMutatingRequest\s*\(/;

export const SCAN_IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  ".git",
  "__fixtures__",
]);

export const SCAN_IGNORE_FILE_SUFFIXES = [".test.ts", ".test.tsx"];
