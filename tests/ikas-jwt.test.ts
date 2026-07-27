import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

const SECRET = "test-client-secret-at-least-32-chars-long";
const key = new TextEncoder().encode(SECRET);

beforeAll(() => {
  process.env.IKAS_CLIENT_SECRET = SECRET;
  process.env.NEXT_PUBLIC_IKAS_CLIENT_ID = "test-client-id";
});

function req(headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/test", { headers });
}

async function sign(payload: Record<string, unknown>, expiresIn = "5m") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

describe("ikas App Bridge session tokens", () => {
  it("reads a Bearer token, case-insensitively", async () => {
    const { readBearerToken } = await import("@/lib/auth/ikas-jwt");
    expect(readBearerToken(req({ authorization: "Bearer abc" }))).toBe("abc");
    expect(readBearerToken(req({ authorization: "bearer abc" }))).toBe("abc");
  });

  it("returns null when there is no Bearer token", async () => {
    const { readBearerToken } = await import("@/lib/auth/ikas-jwt");
    expect(readBearerToken(req())).toBeNull();
    expect(readBearerToken(req({ authorization: "Basic xyz" }))).toBeNull();
    expect(readBearerToken(req({ authorization: "Bearer " }))).toBeNull();
  });

  it("accepts a validly signed token and extracts the store id", async () => {
    const { verifyIkasSessionToken } = await import("@/lib/auth/ikas-jwt");
    const token = await sign({ merchantId: "store_123", authorizedAppId: "app_9" });
    const claims = await verifyIkasSessionToken(token);
    expect(claims?.merchantId).toBe("store_123");
    expect(claims?.authorizedAppId).toBe("app_9");
  });

  it("falls back to sub/aud when the named claims are absent", async () => {
    const { verifyIkasSessionToken } = await import("@/lib/auth/ikas-jwt");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("store_from_sub")
      .setAudience("app_from_aud")
      .setExpirationTime("5m")
      .sign(key);
    const claims = await verifyIkasSessionToken(token);
    expect(claims?.merchantId).toBe("store_from_sub");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const { verifyIkasSessionToken } = await import("@/lib/auth/ikas-jwt");
    const forged = await new SignJWT({ merchantId: "store_123" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("a-completely-different-secret-value!!"));
    expect(await verifyIkasSessionToken(forged)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const { verifyIkasSessionToken } = await import("@/lib/auth/ikas-jwt");
    const expired = await sign({ merchantId: "store_123" }, "-1m");
    expect(await verifyIkasSessionToken(expired)).toBeNull();
  });

  it("rejects a token carrying no store id", async () => {
    const { verifyIkasSessionToken } = await import("@/lib/auth/ikas-jwt");
    const anonymous = await sign({ somethingElse: true });
    expect(await verifyIkasSessionToken(anonymous)).toBeNull();
  });

  it("rejects garbage without throwing", async () => {
    const { verifyIkasSessionToken } = await import("@/lib/auth/ikas-jwt");
    expect(await verifyIkasSessionToken("not.a.jwt")).toBeNull();
    expect(await verifyIkasSessionToken("")).toBeNull();
  });
});
