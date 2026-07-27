import { NextResponse } from "next/server";

import { isConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { resolveTenant } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

/**
 * Actually round-trips to Postgres. Env-var presence proves nothing about
 * connectivity — this is the check that does.
 */
async function probeDatabase() {
  if (!isConfigured.database()) return { reachable: false, reason: "not configured" };
  try {
    const [merchants, conversations, announcements] = await Promise.all([
      prisma.merchant.count(),
      prisma.conversation.count(),
      prisma.announcement.count(),
    ]);
    return { reachable: true, rows: { merchants, conversations, announcements } };
  } catch (e) {
    return { reachable: false, reason: (e as Error).message.slice(0, 200) };
  }
}

/**
 * Deployment diagnostics. Reports ONLY which config groups resolve — never a
 * value, never a fragment of one. Exists so "is this env var reaching the
 * running function?" can be answered from outside instead of guessed at.
 */
export async function GET(req: Request) {
  const tenant = await resolveTenant(req);
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    db: await probeDatabase(),
    // How (and whether) the caller's tenant resolved — embedded vs standalone.
    tenant: { resolved: Boolean(tenant.merchantId), source: tenant.source },
    configured: {
      database: isConfigured.database(),
      supabase: isConfigured.supabase(),
      ai: isConfigured.ai(),
      ikas: isConfigured.ikas(),
      embeddings: isConfigured.embeddings(),
      qstash: isConfigured.qstash(),
    },
    // Which name the db url resolved from — the whole point of this check.
    dbUrlSource: process.env.DATABASE_URL
      ? "DATABASE_URL"
      : process.env.POSTGRES_PRISMA_URL
        ? "POSTGRES_PRISMA_URL"
        : null,
    directUrlSource: process.env.DIRECT_URL
      ? "DIRECT_URL"
      : process.env.POSTGRES_URL_NON_POOLING
        ? "POSTGRES_URL_NON_POOLING"
        : null,
    secrets: {
      encryptionKey: Boolean(process.env.ENCRYPTION_KEY),
      cookiePassword: Boolean(process.env.SECRET_COOKIE_PASSWORD),
      serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  });
}
