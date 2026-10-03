import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { SESSION_COOKIE, sessionOk } from "@/lib/passcode";
import { deliverPush, expiredPush, pushConfigured, validPushEndpoint, validPushKeys } from "@/lib/push";

export const runtime = "nodejs";
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const authorized = (request: NextRequest) => sessionOk(request.cookies.get(SESSION_COOKIE)?.value);

export function GET(request: NextRequest) {
  if (!authorized(request)) return reply({ error: "נדרשת כניסה מחדש" }, 401);
  return reply({ publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return reply({ error: "נדרשת כניסה מחדש" }, 401);
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply({ error: "בקשה לא מורשית" }, 403);
  const body = await request.text();
  if (body.length > 4096) return reply({ error: "בקשה גדולה מדי" }, 413);
  let data;
  try { data = JSON.parse(body); } catch { return reply({ error: "בקשה לא תקינה" }, 400); }
  if (!data || !validPushEndpoint(data.endpoint)) return reply({ error: "כתובת התראות לא נתמכת" }, 400);
  const db = getDb();
  try {
    if (data.action === "unsubscribe") {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint));
      return reply({ ok: true });
    }
    if (!pushConfigured()) return reply({ error: "ההתראות עדיין לא הוגדרו באתר" }, 503);
    if (data.action === "subscribe") {
      if (!validPushKeys(data.keys)) return reply({ error: "מפתחות התראות לא תקינים" }, 400);
      const values = { endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth, updatedAt: new Date() };
      await db.insert(pushSubscriptions).values(values).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
      return reply({ ok: true });
    }
    const [subscription] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint)).limit(1);
    if (data.action === "status") return reply({ subscribed: !!subscription });
    if (data.action !== "test") return reply({ error: "פעולה לא תקינה" }, 400);
    if (!subscription) return reply({ error: "יש להפעיל התראות קודם" }, 404);
    try {
      await deliverPush(subscription, { title: "liberoBot · ההתראות מוכנות", body: "כאן יגיעו סיכום הבוקר והתראות על תקלות בסריקה.", tag: "libero-test" });
    } catch (error) {
      if (expiredPush(error)) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
        return reply({ error: "הרישום פג. כבה והפעל שוב את ההתראות." }, 410);
      }
      throw error;
    }
    return reply({ ok: true });
  } catch {
    return reply({ error: "הפעולה נכשלה. נסה שוב בעוד רגע." }, 503);
  }
}
