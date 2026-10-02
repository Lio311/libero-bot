import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// The whole dashboard sits behind one passcode (env DASHBOARD_PASSCODE). A correct entry sets
// an httpOnly cookie holding an HMAC (keyed by AUTH_SECRET) of the passcode's hash, so changing
// either value signs everyone out. No passcode configured = open (local development).

export const SESSION_COOKIE = "libero_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90;

export const passcodeRequired = () => !!process.env.DASHBOARD_PASSCODE;

const sha256 = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time check; always true when no passcode is configured. */
export function passcodeOk(input: unknown): boolean {
  const expected = process.env.DASHBOARD_PASSCODE;
  if (!expected) return true;
  if (typeof input !== "string" || input.length > 200) return false;
  // Hash both sides so the comparison runs on equal-length buffers and leaks nothing about length.
  return timingSafeEqual(sha256(input), sha256(expected));
}

export function sessionToken(): string | null {
  const passcode = process.env.DASHBOARD_PASSCODE;
  if (!passcode) return null;
  const secret = process.env.AUTH_SECRET || passcode;
  return createHmac("sha256", secret).update(`libero-dashboard:${sha256(passcode).toString("hex")}`).digest("hex");
}

export function sessionOk(cookie: string | undefined): boolean {
  const expected = sessionToken();
  if (!expected) return true;
  if (!cookie || cookie.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}
