import { z } from "zod";

export const simulateOrderSchema = z.object({
  assetId: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  journalId: z.string().optional(),
});

export const executeOrderSchema = simulateOrderSchema
  .extend({
    journalId: z.string().min(1, "Journal obbligatorio per l'esecuzione."),
    idempotencyKey: z.string().min(8).max(64),
    confirmRisk: z.literal(true, {
      errorMap: () => ({ message: "Conferma rischio obbligatoria." }),
    }),
    mode: z.enum(["MOCK", "PAPER", "LIVE"]).optional(),
    confirmLive: z.literal(true).optional(),
    livePassphrase: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    const mode = data.mode;
    if (mode === "LIVE") {
      if (data.confirmLive !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conferma live obbligatoria per ordini LIVE.",
          path: ["confirmLive"],
        });
      }
      if (!data.livePassphrase) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passphrase live obbligatoria per ordini LIVE.",
          path: ["livePassphrase"],
        });
      }
    }
  });
