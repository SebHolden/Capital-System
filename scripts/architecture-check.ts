import path from "path";
import { scanRepository } from "@/lib/architecture/scan";

const root = path.resolve(__dirname, "..");
const violations = scanRepository(root);

if (violations.length === 0) {
  console.log("Architecture check passed.");
  process.exit(0);
}

console.error(`Architecture check failed with ${violations.length} violation(s):\n`);

for (const violation of violations) {
  const location = violation.line ? `${violation.file}:${violation.line}` : violation.file;
  console.error(`- [${violation.ruleId}] ${location}`);
  console.error(`  ${violation.description}\n`);
}

process.exit(1);
