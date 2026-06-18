import { z } from "zod";

export const listPaperSignalsSchema = z.object({
  strategyId: z.string().optional(),
  status: z.enum(["OPEN", "CLOSED", "EXPIRED"]).optional(),
});

export const activatePaperSchema = z.object({
  primaryAssetId: z.string().min(1).optional(),
});
