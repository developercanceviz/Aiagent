import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";

/**
 * Per-message token/cost tracking. Anthropic pricing is configured here so the
 * admin usage view (Phase 10) can show spend. Persisted onto Message rows
 * (tokensIn/tokensOut); this helper also computes cost for display.
 */

// USD per 1M tokens (approx; update as pricing changes).
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

export function estimateCostUsd(
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"]!;
  return (tokensIn / 1_000_000) * p.input + (tokensOut / 1_000_000) * p.output;
}

export async function recordMessageUsage(args: {
  messageId: string;
  tokensIn: number;
  tokensOut: number;
}): Promise<void> {
  if (!isConfigured.database()) return;
  await prisma.message.update({
    where: { id: args.messageId },
    data: { tokensIn: args.tokensIn, tokensOut: args.tokensOut },
  });
}
