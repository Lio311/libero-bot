import webpush from "web-push";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { pushSubscriptions } from "../db/schema";

export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
export type PushMessage = { title: string; body: string; tag: string };

// Browser-supplied URLs must never allow requests to arbitrary/internal servers.
export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && (
      u.hostname === "fcm.googleapis.com" || u.hostname === "updates.push.services.mozilla.com" ||
      u.hostname === "web.push.apple.com" || u.hostname.endsWith(".push.apple.com")
    );
  } catch { return false; }
}

export function validPushKeys(keys: unknown): keys is { p256dh: string; auth: string } {
  if (!keys || typeof keys !== "object") return false;
  const k = keys as Record<string, unknown>;
  return typeof k.p256dh === "string" && /^[A-Za-z0-9_-]{87}=?$/.test(k.p256dh) &&
    Buffer.from(k.p256dh, "base64url").length === 65 && Buffer.from(k.p256dh, "base64url")[0] === 4 &&
    typeof k.auth === "string" && /^[A-Za-z0-9_-]{22}(==)?$/.test(k.auth) && Buffer.from(k.auth, "base64url").length === 16;
}

export async function deliverPush(subscription: { endpoint: string; p256dh: string; auth: string }, message: PushMessage) {
  if (!pushConfigured()) throw new Error("Push is not configured");
  if (!validPushEndpoint(subscription.endpoint)) throw new Error("Unsupported push endpoint");
  await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    JSON.stringify(message), {
      vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
      TTL: 6 * 60 * 60, timeout: 10_000,
    });
}

export function expiredPush(error: unknown) {
  const status = (error as { statusCode?: number })?.statusCode;
  return status === 404 || status === 410;
}

/** Independent of email. Successful devices are not resent the same daily digest on retry. */
export async function broadcastPush(message: PushMessage, digestDay?: string) {
  const result = { sent: 0, failed: 0 };
  if (!pushConfigured()) return result;
  const db = getDb();
  const subscriptions = await db.select().from(pushSubscriptions);
  for (const sub of subscriptions) {
    if (digestDay && sub.lastDigestDay === digestDay) continue;
    try {
      await deliverPush(sub, message);
      if (digestDay) await db.update(pushSubscriptions).set({ lastDigestDay: digestDay }).where(eq(pushSubscriptions.endpoint, sub.endpoint));
      result.sent++;
    } catch (error) {
      if (expiredPush(error)) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
      else {
        result.failed++;
        // Do not log endpoints, keys or provider response bodies.
        console.error("Push delivery failed", (error as { statusCode?: number })?.statusCode ?? "network/configuration");
      }
    }
  }
  return result;
}
