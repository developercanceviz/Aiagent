import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";

export type AuditEventType =
  | "ai.reply"
  | "human.takeover"
  | "human.return"
  | "lead.captured"
  | "escalated"
  | "ikas.connected"
  | "products.synced";

/** Append a tenant-scoped audit event. Silently no-ops without a database. */
export async function logEvent(args: {
  merchantId: string;
  conversationId?: string;
  type: AuditEventType;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (!isConfigured.database()) return;
  try {
    await prisma.conversationEvent.create({
      data: {
        merchantId: args.merchantId,
        conversationId: args.conversationId,
        type: args.type,
        data: (args.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[audit] failed to log event", err);
  }
}
