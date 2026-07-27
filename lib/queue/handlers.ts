import type { JobEnvelope, JobName } from "@/lib/queue/types";
import { syncProductsToKnowledge } from "@/lib/jobs/sync-products";
import { handleOrderChanged } from "@/lib/jobs/order-changed";
import { handleCustomerCreated } from "@/lib/jobs/customer-created";
import { processInbound } from "@/lib/jobs/process-inbound";

/** Central job → handler routing. Used by both the inline driver and the
 *  QStash consumer route (app/api/jobs/route.ts). */
export const jobHandlers: Record<
  JobName,
  (payload: unknown) => Promise<void>
> = {
  "ikas.sync-products": (p) => syncProductsToKnowledge(p as { merchantId: string }),
  "ikas.order-changed": (p) => handleOrderChanged(p as { merchantId: string; orderId: string }),
  "ikas.customer-created": (p) => handleCustomerCreated(p as { merchantId: string; customerId: string }),
  "channel.process-inbound": (p) => processInbound(p as { merchantId: string; conversationId: string }),
};

export async function runJob(job: JobEnvelope): Promise<void> {
  const handler = jobHandlers[job.name];
  if (!handler) throw new Error(`No handler for job ${job.name}`);
  await handler(job.payload);
}
