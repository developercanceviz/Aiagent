import { describe, expect, it } from "vitest";

import { assertMerchantId, scoped, TenantScopeError } from "@/lib/db/tenant";

describe("tenant scoping", () => {
  it("throws when merchantId is missing", () => {
    expect(() => assertMerchantId(undefined)).toThrow(TenantScopeError);
    expect(() => assertMerchantId(null)).toThrow(TenantScopeError);
    expect(() => assertMerchantId("")).toThrow(TenantScopeError);
  });

  it("always pins the tenant in a where fragment", () => {
    const where = scoped("m_123", { status: "OPEN" });
    expect(where.merchantId).toBe("m_123");
    expect(where.status).toBe("OPEN");
  });

  it("cannot be overridden by the caller's object", () => {
    // Even if a caller smuggles a merchantId, scoped() pins the real one last.
    const where = scoped("real", { merchantId: "attacker" } as { merchantId: string });
    expect(where.merchantId).toBe("real");
  });
});
