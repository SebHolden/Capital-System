import path from "path";

process.env.DATABASE_URL = `file:${path.resolve(__dirname, "prisma/test-execution.db")}`;
process.env.EXECUTION_MODE = "mock";
process.env.ENABLE_LIVE_TRADING = "false";
