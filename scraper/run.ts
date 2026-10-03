import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import { readFileSync, writeFileSync } from "node:fs";
import { and, eq, getTableColumns, gt, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "../src/db/client";
import { offers, products, scrapeRuns, snapshots, type SnapshotPrice } from "../src/db/schema";
import { israelDay, SOURCES, STALE_AFTER_DAYS, verdictFor, type SourceKey } from "../src/lib/config";
import { sendFailureAlert } from "./lib/email";
import { broadcastPush } from "../src/lib/push";
import { fetchLiberoProducts, type LiberoProduct } from "./lib/libero";
import { detectBrand, matchAll } from "./lib/match";
import { parseTitle } from "./lib/perfume";
import { ALL_SOURCES } from "./sources";
import { BlockedError, type CompetitorItem } from "./types";

// Daily pipeline: Libero catalog → every competitor catalog → match → store offers →
// today's snapshot (verdict per product). The 08:00 email is a separate job (digest.ts).

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const only = flag("only")?.split("=")[1]?.split(",");
const dry = !!flag("dry");
const noEmail = !!flag("no-email");
/** Development: read data/cache/*.json (from `npm run fetch-cache`) instead of the live sites. */
const useCache = !!flag("cache");

const log = (...m: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...m);

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** `set` clause for a batch upsert: each column takes the incoming row's value (EXCLUDED.col). */
function excludedSet<T extends PgTable>(table: T, keys: string[]) {
  const cols = getTableColumns(table) as Record<string, { name: string }>;
  return Object.fromEntries(keys.map((k) => [k, sql.raw(`excluded."${cols[k].name}"`)]));
}

interface Failure {
  source: SourceKey;
  status: "blocked" | "error";
  message: string;
}

async function main() {
  const db = dry ? null : getDb();
  if (db) await migrate(db, { migrationsFolder: "drizzle" });
  const runStart = new Date();
  const day = israelDay(runStart);

  // 1) Libero
  const { products: catalog, excluded } = useCache
    ? { products: JSON.parse(readFileSync("data/cache/libero.json", "utf8")) as LiberoProduct[], excluded: 0 }
    : await fetchLiberoProducts();
  log(`libero: ${catalog.length} products in the comparison (${excluded} minis/samples/bundles/accessories left out)`);
  if (catalog.length < 50) throw new Error(`only ${catalog.length} Libero products came back; refusing to overwrite the comparison`);

  if (db) {
    const rows = catalog.map((p) => {
      const parsed = parseTitle(p.name);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        url: p.url,
        image: p.image,
        price: p.price,
        regularPrice: p.regularPrice,
        onSale: p.onSale,
        stockQty: p.stockQty,
        categories: p.categories,
        ml: parsed.ml,
        conc: parsed.conc,
        tester: parsed.tester,
        active: true,
        lastSeenAt: runStart,
      };
    });
    for (const chunk of chunks(rows, 200))
      await db.insert(products).values(chunk).onConflictDoUpdate({ target: products.id, set: excludedSet(products, Object.keys(rows[0]).filter((k) => k !== "id")) });
    // Out of stock, unpublished or moved to an excluded category since the last run.
    await db
      .update(products)
      .set({ active: false })
      .where(notInArray(products.id, catalog.map((p) => p.id)));
  }

  // 2) Competitors, in parallel (different hosts; each source paces its own requests).
  const sources = only ? ALL_SOURCES.filter((s) => only.includes(s.key)) : ALL_SOURCES;
  const items: CompetitorItem[] = [];
  const ok = new Set<SourceKey>();
  const failures: Failure[] = [];
  const runIds = new Map<SourceKey, number>();
  await Promise.all(
    sources.map(async (source) => {
      const t = Date.now();
      if (db) {
        const [run] = await db.insert(scrapeRuns).values({ source: source.key, status: "running" }).returning({ id: scrapeRuns.id });
        runIds.set(source.key, run.id);
      }
      try {
        const res = useCache
          ? { items: JSON.parse(readFileSync(`data/cache/${source.key}.json`, "utf8")) as CompetitorItem[], warnings: ["from cache"] }
          : await source.run();
        if (res.items.length < 20) throw new Error(`only ${res.items.length} items; the site layout may have changed`);
        items.push(...res.items);
        ok.add(source.key);
        log(`${source.key}: ${res.items.length} items (${res.items.filter((i) => i.inStock).length} in stock) in ${Math.round((Date.now() - t) / 1000)}s`);
        res.warnings.forEach((w) => log(`  ⚠ ${source.key}: ${w}`));
        if (db)
          await db
            .update(scrapeRuns)
            .set({ status: "ok", found: res.items.length, message: res.warnings.slice(0, 3).join(" · ") || null })
            .where(eq(scrapeRuns.id, runIds.get(source.key)!));
      } catch (e) {
        const status = e instanceof BlockedError ? "blocked" : "error";
        const message = (e as Error).message.slice(0, 500);
        failures.push({ source: source.key, status, message });
        log(`${source.key}: ${status.toUpperCase()} ${message}`);
        if (db)
          await db
            .update(scrapeRuns)
            .set({ status, message, finishedAt: new Date() })
            .where(eq(scrapeRuns.id, runIds.get(source.key)!));
      }
    }),
  );

  // 3) Match (wrong matches the owner rejected are never proposed again).
  const rejectedRows = db
    ? await db.select({ productId: offers.productId, source: offers.source, externalId: offers.externalId }).from(offers).where(isNotNull(offers.rejectedAt))
    : [];
  const rejected = new Set(rejectedRows.map((r) => `${r.productId}:${r.source}:${r.externalId}`));
  const { matches, stats, lexicon } = matchAll(catalog, items, rejected);
  log(`matched: ${matches.length} offers over ${new Set(matches.map((m) => m.productId)).size}/${catalog.length} products`, stats.competitorUsable);

  if (dry) {
    writeFileSync("dry-run.json", JSON.stringify(matches, null, 1));
    log(`dry run: ${matches.length} matches written to dry-run.json`);
    return failures.length < sources.length;
  }

  // Brands for the dashboard filter (needs the brand list learned from today's competitor data).
  const brands = new Map<string, number[]>();
  for (const p of catalog) {
    const b = detectBrand(p.name, lexicon);
    if (b) (brands.get(b) ?? brands.set(b, []).get(b)!).push(p.id);
  }
  await db!.update(products).set({ brand: null }).where(inArray(products.id, catalog.map((p) => p.id)));
  for (const [brand, ids] of brands) await db!.update(products).set({ brand }).where(inArray(products.id, ids));

  // 4) Store offers.
  const offerIds = new Map<string, number>(); // `${productId}:${source}` → offers.id
  const offerRows = matches.map((m) => ({
    productId: m.productId,
    source: m.item.source,
    externalId: m.item.externalId,
    url: m.item.url,
    title: m.item.title,
    price: m.item.price,
    regularPrice: m.item.regularPrice ?? null,
    inStock: m.item.inStock,
    method: m.method,
    score: m.score,
    concAssumed: m.concAssumed,
    lastSeenAt: runStart,
  }));
  for (const chunk of chunks(offerRows, 300)) {
    const saved = await db!
      .insert(offers)
      .values(chunk)
      .onConflictDoUpdate({
        target: [offers.productId, offers.source, offers.externalId],
        set: excludedSet(offers, ["url", "title", "price", "regularPrice", "inStock", "method", "score", "concAssumed", "lastSeenAt"]),
      })
      .returning({ id: offers.id, productId: offers.productId, source: offers.source });
    for (const r of saved) offerIds.set(`${r.productId}:${r.source}`, r.id);
  }
  for (const s of ok) {
    const n = matches.filter((m) => m.item.source === s).length;
    await db!.update(scrapeRuns).set({ matched: n, finishedAt: new Date() }).where(eq(scrapeRuns.id, runIds.get(s)!));
  }

  // 5) Sites that failed today keep their last good reading for a few days (marked stale).
  const failed = failures.map((f) => f.source);
  const staleRows = failed.length
    ? await db!
        .select()
        .from(offers)
        .where(
          and(
            inArray(offers.source, failed),
            isNull(offers.rejectedAt),
            gt(offers.lastSeenAt, new Date(Date.now() - STALE_AFTER_DAYS * 86_400_000)),
          ),
        )
    : [];
  const stale = new Map<string, (typeof staleRows)[number]>();
  for (const r of staleRows) {
    const k = `${r.productId}:${r.source}`;
    if (!stale.has(k) || stale.get(k)!.lastSeenAt < r.lastSeenAt) stale.set(k, r);
  }

  // 6) Today's snapshot.
  const ignored = new Set(
    (await db!.select({ id: products.id }).from(products).where(isNotNull(products.ignoredAt))).map((r) => r.id),
  );
  const byProduct = new Map<number, typeof matches>();
  for (const m of matches) (byProduct.get(m.productId) ?? byProduct.set(m.productId, []).get(m.productId)!).push(m);
  const counts = { pricier: 0, cheaper: 0, same: 0, unmatched: 0 };
  const rows = catalog
    .filter((p) => !ignored.has(p.id))
    .map((p) => {
      const prices: Record<string, SnapshotPrice> = {};
      for (const m of byProduct.get(p.id) ?? [])
        prices[m.item.source] = { p: m.item.price, st: m.item.inStock, o: offerIds.get(`${p.id}:${m.item.source}`)! };
      for (const s of failed) {
        const r = stale.get(`${p.id}:${s}`);
        if (r) prices[s] = { p: r.price, st: r.inStock, o: r.id, x: true };
      }
      const live = Object.entries(prices).filter(([, v]) => v.st);
      const min = live.length ? live.reduce((a, b) => (b[1].p < a[1].p ? b : a)) : null;
      const gap = min ? p.price - min[1].p : null;
      const verdict = verdictFor(gap);
      counts[verdict]++;
      return { day, productId: p.id, liberoPrice: p.price, minPrice: min?.[1].p ?? null, minSource: min?.[0] ?? null, gap, verdict, prices };
    });
  await db!.delete(snapshots).where(eq(snapshots.day, day));
  for (const chunk of chunks(rows, 200)) await db!.insert(snapshots).values(chunk);
  // Keep about 13 months of daily history.
  await db!.delete(snapshots).where(sql`${snapshots.day} < current_date - interval '400 days'`);
  log(`snapshot ${day}:`, counts);

  // 7) Immediate alert when a site failed (the 08:00 digest is separate).
  if (failures.length && !noEmail) {
    try {
      await sendFailureAlert(db!, day, failures.map((f) => ({ ...f, name: SOURCES[f.source].name })));
      log("failure alert sent");
    } catch (e) {
      log(`failure alert not sent: ${(e as Error).message}`);
    }
    try {
      const push = await broadcastPush({
        title: "liberoBot · בעיה בסריקה",
        body: `${failures.map((f) => SOURCES[f.source].name).join(", ")} נכשלו בסריקה. הפרטים בדשבורד.`,
        tag: `libero-alert-${day}`,
      });
      log(`failure push: ${push.sent} sent, ${push.failed} failed`);
    } catch {
      log("failure push not sent; check push configuration and database");
    }
  }
  return ok.size > 0;
}

main()
  .then(async (success) => {
    await closeDb();
    process.exit(success ? 0 : 1);
  })
  .catch(async (e) => {
    console.error(e);
    await closeDb();
    process.exit(1);
  });
