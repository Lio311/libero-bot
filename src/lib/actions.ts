"use server";

import { and, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { offers, products, snapshots, type SnapshotPrice } from "@/db/schema";
import { verdictFor } from "@/lib/config";
import { getHistory, type HistoryPoint } from "@/lib/data";
import { SESSION_COOKIE, sessionOk } from "@/lib/passcode";

// Dashboard mutations. The proxy already guards the page, but server actions are POST endpoints,
// so each one re-checks the session itself.

type Result = { ok: true } | { ok: false; reason: string };

async function authed() {
  return sessionOk((await cookies()).get(SESSION_COOKIE)?.value);
}

/** "Wrong match": never match this competitor listing to this product again, and fix today's verdict. */
export async function rejectMatch(offerId: number): Promise<Result> {
  if (!(await authed())) return { ok: false, reason: "auth" };
  const db = getDb();
  const [offer] = await db.update(offers).set({ rejectedAt: new Date() }).where(eq(offers.id, offerId)).returning();
  if (!offer) return { ok: false, reason: "not found" };
  // Recompute the latest snapshot row without that site.
  const [row] = await db.select().from(snapshots).where(eq(snapshots.productId, offer.productId)).orderBy(desc(snapshots.day)).limit(1);
  if (row && row.prices[offer.source]?.o === offer.id) {
    const prices: Record<string, SnapshotPrice> = { ...row.prices };
    delete prices[offer.source];
    const live = Object.entries(prices).filter(([, v]) => v.st);
    const min = live.length ? live.reduce((a, b) => (b[1].p < a[1].p ? b : a)) : null;
    const gap = min ? row.liberoPrice - min[1].p : null;
    await db
      .update(snapshots)
      .set({ prices, minPrice: min?.[1].p ?? null, minSource: min?.[0] ?? null, gap, verdict: verdictFor(gap) })
      .where(and(eq(snapshots.day, row.day), eq(snapshots.productId, row.productId)));
  }
  return { ok: true };
}

/** Stop (or resume) tracking a product. Takes effect in the next daily run; the dashboard hides it now. */
export async function setIgnored(productId: number, ignored: boolean): Promise<Result> {
  if (!(await authed())) return { ok: false, reason: "auth" };
  await getDb().update(products).set({ ignoredAt: ignored ? new Date() : null }).where(eq(products.id, productId));
  return { ok: true };
}

export async function loadHistory(productId: number): Promise<HistoryPoint[]> {
  if (!(await authed())) return [];
  return getHistory(productId);
}
