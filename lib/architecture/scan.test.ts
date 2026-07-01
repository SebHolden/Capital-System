import path from "path";
import { describe, expect, it } from "vitest";
import { scanFile, scanRepository } from "./scan";

describe("architecture scan", () => {
  it("fails when a strategy imports brokers", () => {
    const violations = scanFile(
      "lib/strategies/foo.ts",
      `import { getBroker } from "@/lib/brokers";\nexport function signal() { return "BUY"; }`,
    );

    expect(violations.some((v) => v.ruleId === "import-brokers")).toBe(true);
  });

  it("passes for a pure strategy", () => {
    const violations = scanFile(
      "lib/strategies/foo.ts",
      `export function signal() { return "BUY"; }`,
    );

    expect(violations).toHaveLength(0);
  });

  it("fails when backtesting imports execution", () => {
    const violations = scanFile(
      "lib/backtesting/foo.ts",
      `import { executeOrder } from "@/lib/execution";\nexport async function run() {}`,
    );

    expect(violations.some((v) => v.ruleId === "import-execution")).toBe(true);
  });

  it("fails when backtesting creates OrderIntent", () => {
    const violations = scanFile(
      "lib/backtesting/foo.ts",
      `await prisma.orderIntent.create({ data: {} });`,
    );

    expect(violations.some((v) => v.ruleId === "order-intent-create")).toBe(true);
  });

  it("fails when paper signals call executeOrder", () => {
    const violations = scanFile(
      "lib/paper-signals/foo.ts",
      `import { executeOrder } from "@/lib/execution";\nawait executeOrder({});`,
    );

    expect(violations.some((v) => v.ruleId === "call-execute-order")).toBe(true);
  });

  it("fails when autopilot calls getBroker", () => {
    const violations = scanFile(
      "lib/autopilot/foo.ts",
      `import { getBroker } from "@/lib/brokers";\nawait getBroker("LIVE");`,
    );

    expect(violations.some((v) => v.ruleId === "call-get-broker")).toBe(true);
  });

  it("fails when Python contains broker credentials", () => {
    const violations = scanFile(
      "research/foo.py",
      `ALPACA_API_KEY = os.environ["ALPACA_API_KEY"]`,
    );

    expect(violations.some((v) => v.ruleId === "py-alpaca-key")).toBe(true);
  });

  it("passes for benign Python research code", () => {
    const violations = scanFile(
      "research/foo.py",
      `import pandas as pd\n\ndef run_backtest():\n    return pd.DataFrame()`,
    );

    expect(violations).toHaveLength(0);
  });

  it("fails when a mutating API route omits verifyMutatingRequest", () => {
    const violations = scanFile(
      "app/api/example/route.ts",
      `export async function POST(request: Request) {\n  return Response.json({ ok: true });\n}`,
    );

    expect(violations.some((v) => v.ruleId === "api-missing-verify-mutating-request")).toBe(
      true,
    );
  });

  it("passes when a mutating API route uses verifyMutatingRequest", () => {
    const violations = scanFile(
      "app/api/example/route.ts",
      `import { verifyMutatingRequest } from "@/lib/security";\nexport async function POST(request: Request) {\n  verifyMutatingRequest(request);\n  return Response.json({ ok: true });\n}`,
    );

    expect(violations).toHaveLength(0);
  });

  it("passes on the current repository", () => {
    const root = path.resolve(__dirname, "../..");
    const violations = scanRepository(root);

    expect(violations).toEqual([]);
  });
});
