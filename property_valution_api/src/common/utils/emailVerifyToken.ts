import crypto from "crypto";

const EMAIL_VERIFY_TOKEN_BYTES = 32;
const EMAIL_VERIFY_TOKEN_REGEX = /^[a-f0-9]{64}$/i;
const DEFAULT_EMAIL_VERIFY_EXPIRY_HOURS = 24;

function getEmailVerifyExpiryHours() {
  const raw = process.env.EMAIL_TOKEN_EXPIRES_HOURS;
  if (!raw) return DEFAULT_EMAIL_VERIFY_EXPIRY_HOURS;

  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0) {
    return DEFAULT_EMAIL_VERIFY_EXPIRY_HOURS;
  }

  return Math.floor(hours);
}

export function generateEmailVerifyToken() {
  const token = crypto.randomBytes(EMAIL_VERIFY_TOKEN_BYTES).toString("hex");
  const tokenHash = hashEmailVerifyToken(token);
  const expiresAt = new Date(Date.now() + getEmailVerifyExpiryHours() * 60 * 60 * 1000);

  return { token, tokenHash, expiresAt };
}

export function normalizeEmailVerifyToken(token: string) {
  return token.trim();
}

export function isWellFormedEmailVerifyToken(token: string) {
  return EMAIL_VERIFY_TOKEN_REGEX.test(token);
}

export function hashEmailVerifyToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
