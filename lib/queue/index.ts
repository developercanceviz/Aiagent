import { after } from "next/server";

import { env, isConfigured } from "@/lib/config/env";
import type { JobEnvelope, QueueDriver } from "@/lib/queue/types";
import { runJob } from "@/lib/queue/handlers";

/** Inline driver — runs the handler in the same invocation. No-QStash fallback. */
const inlineDriver: QueueDriver = {
  kind: "inline",
  async enqueue(job) {
    // after() keeps the serverless function alive past the response. A bare
    // `void runJob(...)` gets KILLED the moment the response is sent —
    // observed live: the on-connect product sync died after 1 of 112
    // products. The response still returns fast; the work runs after it.
    after(async () => {
      try {
        await runJob(job);
      } catch (err) {
        console.error(`[queue:inline] job ${job.name} failed`, err);
      }
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
