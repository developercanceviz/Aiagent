import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/config/env";

/**
 * Singleton Prisma client. In dev, reuse across HMR reloads to avoid
 * exhausting the connection pool.
 *
 * The datasource url is resolved at runtime rather than left to the schema's
 * env("DATABASE_URL"), so a Vercel deploy can run off the Supabase
 * integration's POSTGRES_PRISMA_URL without duplicating it by hand.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const datasourceUrl = env.databaseUrl;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
