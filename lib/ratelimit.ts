/**
 * Lightweight fixed-window rate limiter (in-memory). Good enough per-instance
 * for the embeddable Web Chat endpoint; swap for @upstash/ratelimit (Redis) for
 * multi-instance correctness in production — same `check()` signature.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  opts: { limit?: number; windowMs?: number } = {}
): RateLimitResult {
  const limit = opts.limit ?? 20;
  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  return { ok: bucket.count <= limit, remaining, resetAt: bucket.resetAt };
}

/** Best-effort client key from request headers. */
export function clientKey(req: Request, prefix: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return `${prefix}:${ip}`;
}
