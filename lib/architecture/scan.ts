import fs from "fs";
import path from "path";
import {
  MUTATING_HANDLER_PATTERN,
  PYTHON_RULE_SET,
  RULE_SETS,
  SCAN_IGNORE_DIRS,
  SCAN_IGNORE_FILE_SUFFIXES,
  VERIFY_MUTATING_REQUEST_PATTERN,
  type ArchitectureRule,
  type RuleSet,
} from "./rules";

export interface ArchitectureViolation {
  file: string;
  ruleId: string;
  description: string;
  line?: number;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function lineNumberForMatch(content: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(content);
  if (!match || match.index === undefined) return undefined;
  return content.slice(0, match.index).split("\n").length;
}

function matchRules(
  filePath: string,
  content: string,
  rules: ArchitectureRule[],
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];

  for (const rule of rules) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    if (pattern.test(content)) {
      violations.push({
        file: filePath,
        ruleId: rule.id,
        description: rule.description,
        line: lineNumberForMatch(content, pattern),
      });
    }
  }

  return violations;
}

function appliesRuleSet(filePath: string, ruleSet: RuleSet): boolean {
  const normalized = normalizePath(filePath);

  if (ruleSet.id === "python") {
    return normalized.endsWith(".py");
  }

  return normalized.includes(ruleSet.pathPrefix);
}

function scanApiRoute(filePath: string, content: string): ArchitectureViolation[] {
  const normalized = normalizePath(filePath);
  if (!normalized.includes("app/api/") || !normalized.endsWith(".ts")) {
    return [];
  }

  if (!MUTATING_HANDLER_PATTERN.test(content)) {
    return [];
  }

  if (VERIFY_MUTATING_REQUEST_PATTERN.test(content)) {
    return [];
  }

  return [
    {
      file: filePath,
      ruleId: "api-missing-verify-mutating-request",
      description:
        "mutating API route must call verifyMutatingRequest() for CSRF and Origin protection",
    },
  ];
}

export function scanFile(filePath: string, content: string): ArchitectureViolation[] {
  const normalized = normalizePath(filePath);
  const violations: ArchitectureViolation[] = [];

  for (const ruleSet of RULE_SETS) {
    if (!appliesRuleSet(normalized, ruleSet)) continue;
    violations.push(...matchRules(normalized, content, ruleSet.rules));
  }

  if (appliesRuleSet(normalized, PYTHON_RULE_SET)) {
    violations.push(...matchRules(normalized, content, PYTHON_RULE_SET.rules));
  }

  violations.push(...scanApiRoute(normalized, content));

  return violations;
}

function shouldScanFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);

  if (SCAN_IGNORE_FILE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return false;
  }

  if (normalized.includes("lib/architecture/") && normalized.endsWith(".test.ts")) {
    return false;
  }

  return (
    normalized.endsWith(".ts") ||
    normalized.endsWith(".tsx") ||
    normalized.endsWith(".py")
  );
}

function walkDirectory(root: string, dir: string, files: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (SCAN_IGNORE_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkDirectory(root, fullPath, files);
      continue;
    }

    if (!shouldScanFile(fullPath)) continue;

    files.push(path.relative(root, fullPath));
  }
}

export function scanRepository(root: string): ArchitectureViolation[] {
  const files: string[] = [];
  walkDirectory(root, root, files);

  const violations: ArchitectureViolation[] = [];

  for (const relativePath of files.sort()) {
    const fullPath = path.join(root, relativePath);
    const content = fs.readFileSync(fullPath, "utf8");
    violations.push(...scanFile(relativePath, content));
  }

  return violations;
}
