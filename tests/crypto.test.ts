import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

// Provide a key before importing the module under test.
beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("crypto/secrets AES-256-GCM", () => {
  it("round-trips a secret", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto/secrets");
    const plain = "ikas_access_token_abc123";
    const enc = encryptSecret(plain);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encryptSecret } = await import("@/lib/crypto/secrets");
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto/secrets");
    const enc = encryptSecret("secret");
    const tampered = Buffer.from(enc, "base64");
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    expect(() => decryptSecret(tampered.toString("base64"))).toThrow();
  });
});
