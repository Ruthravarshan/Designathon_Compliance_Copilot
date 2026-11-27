import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TokenCryptoError, decryptToken, encryptToken, parseEncryptionKey } from "./token-crypto";

const key = randomBytes(32);

describe("parseEncryptionKey", () => {
  it("accepts a base64 32-byte key", () => {
    const encoded = key.toString("base64");
    expect(parseEncryptionKey(encoded).equals(key)).toBe(true);
  });

  it("accepts a 64-character hex key", () => {
    const encoded = key.toString("hex");
    expect(parseEncryptionKey(encoded).equals(key)).toBe(true);
  });

  it("rejects a short or raw passphrase", () => {
    expect(() => parseEncryptionKey("too-short")).toThrow(TokenCryptoError);
  });
});

describe("token encryption", () => {
  it("round-trips a refresh token", () => {
    const token = "1//0gExampleRefreshTokenValue";
    expect(decryptToken(encryptToken(token, key), key)).toBe(token);
  });

  it("produces different ciphertext for the same plaintext", () => {
    const first = encryptToken("same-value", key);
    const second = encryptToken("same-value", key);
    expect(first).not.toBe(second);
  });

  it("rejects a tampered payload", () => {
    const encrypted = encryptToken("sensitive", key);
    const parts = encrypted.split(".");
    const tampered = [parts[0], parts[1], parts[2], `${parts[3]}AA`].join(".");
    expect(() => decryptToken(tampered, key)).toThrow(TokenCryptoError);
  });

  it("rejects a different key", () => {
    const encrypted = encryptToken("sensitive", key);
    expect(() => decryptToken(encrypted, randomBytes(32))).toThrow(TokenCryptoError);
  });

  it("rejects a malformed payload", () => {
    expect(() => decryptToken("not-encrypted", key)).toThrow(TokenCryptoError);
    expect(() => decryptToken("v2.a.b.c", key)).toThrow(TokenCryptoError);
  });

  it("rejects a key of the wrong length", () => {
    expect(() => encryptToken("x", randomBytes(16))).toThrow(TokenCryptoError);
    expect(() => decryptToken("v1.a.b.c", randomBytes(16))).toThrow(TokenCryptoError);
  });
});
