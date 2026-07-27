/**
 * Central runtime-readiness checks. The app is built to RUN before any
 * credentials exist (Phase 0 deliverable): data layers fall back to mock and
 * API routes return a clear 503 when their backing service isn't configured.
 * These booleans are the single source of truth for "is X wired yet?".
 */

export const env = {
  get databaseUrl() {
    return process.env.DATABASE_URL;
  },
  get anthropicKey() {
    return process.env.ANTHROPIC_API_KEY;
  },
  get encryptionKey() {
    return process.env.ENCRYPTION_KEY;
  },
  get ikasClientId() {
    return process.env.NEXT_PUBLIC_IKAS_CLIENT_ID;
  },
  get ikasClientSecret() {
    return process.env.IKAS_CLIENT_SECRET;
  },
  get supabaseUrl() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL;
  },
  get embeddingsKey() {
    return process.env.EMBEDDINGS_PROVIDER_KEY;
  },
  get qstashToken() {
    return process.env.QSTASH_TOKEN;
  },
  get deployUrl() {
    return process.env.NEXT_PUBLIC_DEPLOY_URL ?? "http://localhost:3000";
  },
};

export const isConfigured = {
  database: () => Boolean(env.databaseUrl),
  ai: () => Boolean(env.anthropicKey),
  ikas: () => Boolean(env.ikasClientId && env.ikasClientSecret),
  supabase: () => Boolean(env.supabaseUrl),
  embeddings: () => Boolean(env.embeddingsKey),
  qstash: () => Boolean(env.qstashToken),
};

/** Thrown by API routes when a required service isn't configured yet. */
export class ServiceNotConfiguredError extends Error {
  constructor(public service: string) {
    super(`${service} is not configured. Add its env vars to enable this route.`);
    this.name = "ServiceNotConfiguredError";
  }
}
