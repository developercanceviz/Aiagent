/**
 * Background-job queue abstraction. Decision: Upstash QStash in production
 * (serverless HTTP queue, Vercel-friendly) — kept behind this interface so it
 * stays swappable (the brief's requirement). In dev / when QSTASH_TOKEN is
 * absent, the inline driver runs the handler immediately.
 */

export type JobName =
  | "ikas.sync-products"
  | "ikas.order-changed"
  | "ikas.customer-created"
  | "channel.process-inbound";

export interface JobEnvelope<T = unknown> {
  name: JobName;
  payload: T;
  /** Idempotency key for dedupe (e.g. webhook id). */
  dedupeId?: string;
}

export interface QueueDriver {
  readonly kind: "qstash" | "inline";
  enqueue<T>(job: JobEnvelope<T>): Promise<void>;
}
