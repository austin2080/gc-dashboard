import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function getRawEncryptionKey() {
  const configured = process.env.MAILBOX_TOKEN_ENCRYPTION_KEY?.trim();
  if (!configured) {
    throw new Error("Missing MAILBOX_TOKEN_ENCRYPTION_KEY.");
  }

  if (/^[A-Fa-f0-9]{64}$/.test(configured)) {
    return Buffer.from(configured, "hex");
  }

  try {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Fall through to hash-based derivation below.
  }

  return createHash("sha256").update(configured, "utf8").digest();
}

export function encryptMailboxToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getRawEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptMailboxToken(value: string) {
  const [ivPart, authTagPart, ciphertextPart] = value.split(".");
  if (!ivPart || !authTagPart || !ciphertextPart) {
    throw new Error("Invalid encrypted mailbox token.");
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getRawEncryptionKey(),
    Buffer.from(ivPart, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagPart, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
