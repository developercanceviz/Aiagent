import { env, isConfigured } from "@/lib/config/env";
import type { JobEnvelope, QueueDriver } from "@/lib/queue/types";
import { runJob } from "@/lib/queue/handlers";

/** Inline driver — runs the handler immediately. Dev/no-QStash fallback. */
const inlineDriver: QueueDriver = {
  kind: "inline",
  async enqueue(job) {
    // Fire-and-forget so the webhook ACKs fast even in inline mode.
    void runJob(job).catch((err) => {
      console.error(`[queue:inline] job ${job.name} failed`, err);
    });
  },
};

/** QStash driver — publishes to the consumer route over HTTP. */
const qstashDriver: QueueDriver = {
  kind: "qstash",
  async enqueue(job) {
    const target = `${env.deployUrl}/api/jobs`;
    const res = await fetch("https://qstash.upstash.io/v2/publish/" + target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.qstashToken}`,
        "Content-Type": "application/json",
        ...(job.dedupeId ? { "Upstash-Deduplication-Id": job.dedupeId } : {}),
      },
      body: JSON.stringify(job),
    });
    if (!res.ok) {
      throw new Error(`QStash publish failed: ${res.status} ${await res.text()}`);
    }
  },
};

export function getQueue(): QueueDriver {
  return isConfigured.qstash() ? qstashDriver : inlineDriver;
}

export async function enqueue<T>(job: JobEnvelope<T>): Promise<void> {
  await getQueue().enqueue(job);
}
