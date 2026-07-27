/**
 * Tenant-scoping helpers. NON-NEGOTIABLE: merchantId is always derived from the
 * authenticated session/app context (Iron Session for ikas app, Supabase Auth
 * for dashboard) — never accepted from the client. These helpers exist so query
 * code can't accidentally forget the scope.
 *
 * RLS in Supabase is the hard backstop (supabase/policies.sql); this layer is
 * the application-side guard that keeps queries honest and typed.
 */

export class TenantScopeError extends Error {
  constructor(message = "Tenant scope is required") {
    super(message);
    this.name = "TenantScopeError";
  }
}

export function assertMerchantId(merchantId: string | null | undefined): string {
  if (!merchantId) throw new TenantScopeError();
  return merchantId;
}

/** Build a Prisma `where` fragment that always pins the tenant. */
export function scoped<T extends object>(
  merchantId: string,
  where?: T
): T & { merchantId: string } {
  return { ...(where ?? ({} as T)), merchantId: assertMerchantId(merchantId) };
}
