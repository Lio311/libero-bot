import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "../src/db/client";
import { emailLog, offers, products, scrapeRuns, snapshots, type Snapshot } from "../src/db/schema";
import { israelDay, SOURCE_KEYS, SOURCES, VERDICT_LABEL, type SourceKey, type Verdict } from "../src/lib/config";
import { sendDigest, type DigestChange, type DigestExample } from "./lib/email";
import { broadcastPush, pushConfigured } from "../src/lib/push";

// The 08:00 summary email. GitHub cron runs in UTC and Israel switches between UTC+2 and
// UTC+3, so the workflow fires at 04:47 and 05:47 UTC and this job sends only once the
// Israel clock reads 07:45 or later (it lands around 08:00), and only once per day (email_log).
// Flags: --force (ignore the clock and the once-a-day guard), --dry (print, don't send).

const args = process.argv.slice(2);
const force = args.includes("--force");
const dry = args.includes("--dry");
const log = (...m: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...m);

const MAX_CHANGES = 6;

async function main() {
  const db = getDb();
  await migrate(db, { migrationsFolder: "drizzle" });
  const today = israelDay();
  const [hh, mm] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date())
    .split(":")
    .map(Number);
  const minutes = hh * 60 + mm;
  let emailSent = false;

  if (!force) {
    if (minutes < 7 * 60 + 45 || minutes > 13 * 60) return log(`Israel time is ${hh}:${String(mm).padStart(2, "0")}; the digest goes out from 07:45`);
    const [sent] = await db.select().from(emailLog).where(and(eq(emailLog.kind, "digest"), eq(emailLog.day, today))).limit(1);
    emailSent = !!sent;
    if (sent && !pushConfigured()) return log(`already sent today: ${sent.subject}`);
  }

  const [latest] = await db.select({ day: snapshots.day }).from(snapshots).orderBy(desc(snapshots.day)).limit(1);
  if (!latest) return log("no snapshot yet; run the scraper first");
  const day = latest.day;
  const [prev] = await db.select({ day: snapshots.day }).from(snapshots).where(lt(snapshots.day, day)).orderBy(desc(snapshots.day)).limit(1);

  const rows = await db.select().from(snapshots).where(eq(snapshots.day, day));
  const prevRows = prev ? await db.select().from(snapshots).where(eq(snapshots.day, prev.day)) : [];
  const prevBy = new Map(prevRows.map((r) => [r.productId, r]));
  const names = new Map(
    (await db.select({ id: products.id, name: products.name, url: products.url }).from(products).where(inArray(products.id, rows.map((r) => r.productId)))).map(
      (p) => [p.id, p],
    ),
  );

  const counts = { pricier: 0, cheaper: 0, same: 0, unmatched: 0 };
  for (const r of rows) counts[r.verdict as Verdict]++;
  const prevCounts = prevRows.length ? { pricier: 0, cheaper: 0, same: 0 } : null;
  if (prevCounts) for (const r of prevRows) if (r.verdict in prevCounts) prevCounts[r.verdict as keyof typeof prevCounts]++;

  // Two biggest ₪ gaps each way, with the competitor's product link.
  const minOfferIds = rows.flatMap((r) => (r.minSource ? [r.prices[r.minSource]?.o] : [])).filter((x): x is number => !!x);
  const offerUrls = new Map(
    minOfferIds.length ? (await db.select({ id: offers.id, url: offers.url }).from(offers).where(inArray(offers.id, minOfferIds))).map((o) => [o.id, o.url]) : [],
  );
  const example = (r: Snapshot): DigestExample => ({
    name: names.get(r.productId)?.name ?? `#${r.productId}`,
    url: names.get(r.productId)?.url ?? "",
    liberoPrice: r.liberoPrice,
    minPrice: r.minPrice!,
    minSource: r.minSource!,
    minUrl: offerUrls.get(r.prices[r.minSource!]?.o) ?? null,
    gap: r.gap!,
  });
  const topPricier = rows.filter((r) => r.verdict === "pricier").sort((a, b) => b.gap! - a.gap!).slice(0, 2).map(example);
  const topCheaper = rows.filter((r) => r.verdict === "cheaper").sort((a, b) => a.gap! - b.gap!).slice(0, 2).map(example);

  // What changed since the previous snapshot: verdict moves first, then cheapest-price moves.
  const changes: (DigestChange & { weight: number })[] = [];
  for (const r of rows) {
    const p = prevBy.get(r.productId);
    if (!p) continue;
    const name = names.get(r.productId)?.name ?? `#${r.productId}`;
    if (p.verdict !== r.verdict) {
      const why =
        p.liberoPrice !== r.liberoPrice
          ? `המחיר בליברו ${p.liberoPrice} ← ${r.liberoPrice}`
          : r.minPrice != null && p.minPrice != null
            ? `הזול ביותר ${p.minPrice} ← ${r.minPrice} (${SOURCES[r.minSource as SourceKey]?.name ?? r.minSource})`
            : r.minPrice == null
              ? "אף מתחרה כבר לא מחזיק במלאי"
              : `${SOURCES[r.minSource as SourceKey]?.name ?? r.minSource} מוכר ב-${r.minPrice}`;
      changes.push({ name, from: VERDICT_LABEL[p.verdict as Verdict], to: VERDICT_LABEL[r.verdict as Verdict], detail: why, weight: 1000 + Math.abs(r.gap ?? 0) });
    }
  }
  const verdictMoves = changes.length;
  for (const r of rows) {
    const p = prevBy.get(r.productId);
    if (!p || p.verdict !== r.verdict || p.minPrice == null || r.minPrice == null) continue;
    const d = r.minPrice - p.minPrice;
    if (Math.abs(d) < 20) continue;
    changes.push({
      name: names.get(r.productId)?.name ?? `#${r.productId}`,
      from: `₪${p.minPrice}`,
      to: `₪${r.minPrice}`,
      detail: `${d < 0 ? "ירידה" : "עלייה"} אצל ${SOURCES[r.minSource as SourceKey]?.name ?? r.minSource} · עדיין ${VERDICT_LABEL[r.verdict as Verdict]}`,
      weight: Math.abs(d),
    });
  }
  changes.sort((a, b) => b.weight - a.weight);
  log(`changes: ${verdictMoves} verdict moves, ${changes.length - verdictMoves} price moves`);

  // Site status from the latest run of each source.
  const runs = await db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.startedAt)).limit(60);
  const sourceStatus = SOURCE_KEYS.map((k) => {
    const r = runs.find((x) => x.source === k);
    return { name: SOURCES[k].name, ok: r?.status === "ok" };
  });

  const data = {
    day,
    staleDay: day !== today,
    counts,
    prevCounts,
    topPricier,
    topCheaper,
    changes: changes.slice(0, MAX_CHANGES),
    changesTotal: changes.length,
    sourceStatus,
    dashboardUrl: process.env.DASHBOARD_URL || null,
  };
  if (dry) {
    const { renderDigest } = await import("./lib/email");
    const { subject, html } = renderDigest(data);
    const { writeFileSync } = await import("node:fs");
    writeFileSync("digest-preview.html", html);
    return log(`dry: ${subject} → digest-preview.html`);
  }
  let emailError: unknown;
  if (!emailSent) {
    try {
      const subject = await sendDigest(db, today, data);
      log(`digest sent: ${subject}`);
    } catch (error) { emailError = error; }
  }
  const push = await broadcastPush({
    title: "liberoBot · סיכום הבוקר",
    body: `${counts.pricier} יקרים יותר · ${counts.cheaper} זולים יותר · ${counts.same} במחיר זהה. ${changes.length} שינויים.${day !== today ? ` הנתונים מ-${day}; הסריקה של היום לא הסתיימה.` : ""}`,
    tag: `libero-digest-${today}`,
  }, force ? undefined : today);
  log(`push: ${push.sent} sent, ${push.failed} failed`);
  if (emailError) throw emailError;
  if (push.failed) throw new Error("Some mobile notifications failed; rerun to retry remaining devices");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
