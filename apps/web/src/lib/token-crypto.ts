import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenCryptoError";
  }
}

/**
 * Accepts a 32-byte key as base64, base64url, or 64-character hex. A raw
 * passphrase is rejected so a weak key cannot silently encrypt production
 * refresh tokens.
 */
export function parseEncryptionKey(raw: string): Buffer {
  const trimmed = raw.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");

  if (key.length !== KEY_BYTES) {
    throw new TokenCryptoError(
      "TOKEN_ENCRYPTION_KEY must decode to 32 bytes (base64 or 64-char hex).",
    );
  }

  return key;
}

export function encryptToken(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new TokenCryptoError("Encryption key must be 32 bytes.");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptToken(payload: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new TokenCryptoError("Encryption key must be 32 bytes.");
  }

  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new TokenCryptoError("Unsupported encrypted token format.");
  }

  const iv = Buffer.from(parts[1] ?? "", "base64url");
  const tag = Buffer.from(parts[2] ?? "", "base64url");
  const ciphertext = Buffer.from(parts[3] ?? "", "base64url");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new TokenCryptoError("Encrypted token is malformed.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new TokenCryptoError("Encrypted token could not be verified.");
  }
}
