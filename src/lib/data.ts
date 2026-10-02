import "server-only";
import { desc, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { offers, products, scrapeRuns, snapshots } from "@/db/schema";
import { SOURCE_KEYS, type Verdict } from "@/lib/config";

export interface OfferView {
  id: number;
  source: string;
  price: number;
  inStock: boolean;
  /** The site failed today; this is its last good reading. */
  stale: boolean;
  url: string;
  title: string;
  method: string;
  concAssumed: boolean;
}

export interface ProductView {
  id: number;
  name: string;
  sku: string | null;
  url: string;
  image: string | null;
  brand: string | null;
  categories: string[];
  ml: number | null;
  conc: string | null;
  tester: boolean;
  stockQty: number | null;
  onSale: boolean;
  regularPrice: number | null;
  price: number;
  verdict: Verdict;
  gap: number | null;
  /** gap as a share of the cheapest competitor price. */
  gapPct: number | null;
  minPrice: number | null;
  minSource: string | null;
  /** Every matched site, cheapest first (out-of-stock last). */
  offers: OfferView[];
  /** The previous snapshot for this product, if any. */
  prev: { verdict: Verdict; gap: number | null; minPrice: number | null; price: number } | null;
  ignored: boolean;
}

export interface SourceStatus {
  source: string;
  status: string;
  found: number;
  matched: number;
  message: string | null;
  finishedAt: string | null;
}

export interface DashboardData {
  day: string | null;
  prevDay: string | null;
  products: ProductView[];
  status: SourceStatus[];
  lastRun: string | null;
  now: number;
}

export async function getDashboardData(): Promise<DashboardData> {
  const db = getDb();
  const now = Date.now();
  const [latest] = await db.select({ day: snapshots.day }).from(snapshots).orderBy(desc(snapshots.day)).limit(1);
  const status = await getStatus();
  const lastRun = status.reduce<string | null>((a, s) => (s.finishedAt && (!a || s.finishedAt > a) ? s.finishedAt : a), null);
  if (!latest) return { day: null, prevDay: null, products: [], status, lastRun, now };

  const [prev] = await db.select({ day: snapshots.day }).from(snapshots).where(lt(snapshots.day, latest.day)).orderBy(desc(snapshots.day)).limit(1);
  const rows = await db.select().from(snapshots).where(eq(snapshots.day, latest.day));
  const prevRows = prev ? await db.select().from(snapshots).where(eq(snapshots.day, prev.day)) : [];
  const prevBy = new Map(prevRows.map((r) => [r.productId, r]));

  const ids = rows.map((r) => r.productId);
  const prods = ids.length ? await db.select().from(products).where(inArray(products.id, ids)) : [];
  const prodBy = new Map(prods.map((p) => [p.id, p]));
  const offerIds = rows.flatMap((r) => Object.values(r.prices).map((p) => p.o));
  const offerRows = offerIds.length
    ? await db
        .select({ id: offers.id, url: offers.url, title: offers.title, method: offers.method, concAssumed: offers.concAssumed, rejectedAt: offers.rejectedAt })
        .from(offers)
        .where(inArray(offers.id, offerIds))
    : [];
  const offerBy = new Map(offerRows.map((o) => [o.id, o]));

  const list: ProductView[] = [];
  for (const r of rows) {
    const p = prodBy.get(r.productId);
    if (!p) continue;
    const views: OfferView[] = Object.entries(r.prices)
      .map(([source, sp]) => {
        const o = offerBy.get(sp.o);
        if (!o || o.rejectedAt) return null;
        return { id: sp.o, source, price: sp.p, inStock: sp.st, stale: !!sp.x, url: o.url, title: o.title, method: o.method, concAssumed: o.concAssumed };
      })
      .filter((x): x is OfferView => x !== null)
      .sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price);
    const pr = prevBy.get(r.productId);
    list.push({
      id: p.id,
      name: p.name,
      sku: p.sku,
      url: p.url,
      image: p.image,
      brand: p.brand,
      categories: p.categories,
      ml: p.ml,
      conc: p.conc,
      tester: p.tester,
      stockQty: p.stockQty,
      onSale: p.onSale,
      regularPrice: p.regularPrice,
      price: r.liberoPrice,
      verdict: r.verdict as Verdict,
      gap: r.gap,
      gapPct: r.gap != null && r.minPrice ? r.gap / r.minPrice : null,
      minPrice: r.minPrice,
      minSource: r.minSource,
      offers: views,
      prev: pr ? { verdict: pr.verdict as Verdict, gap: pr.gap, minPrice: pr.minPrice, price: pr.liberoPrice } : null,
      ignored: !!p.ignoredAt,
    });
  }
  // Products the owner ignored drop out of the next snapshot; keep them listable for undo.
  const ignoredRows = await db.select().from(products).where(eq(products.active, true));
  for (const p of ignoredRows) {
    if (!p.ignoredAt || prodBy.has(p.id)) continue;
    list.push({
      id: p.id, name: p.name, sku: p.sku, url: p.url, image: p.image, brand: p.brand, categories: p.categories, ml: p.ml, conc: p.conc, tester: p.tester,
      stockQty: p.stockQty, onSale: p.onSale, regularPrice: p.regularPrice, price: p.price, verdict: "unmatched", gap: null, gapPct: null,
      minPrice: null, minSource: null, offers: [], prev: null, ignored: true,
    });
  }
  return { day: latest.day, prevDay: prev?.day ?? null, products: list, status, lastRun, now };
}

async function getStatus(): Promise<SourceStatus[]> {
  const db = getDb();
  const runs = await db
    .selectDistinctOn([scrapeRuns.source])
    .from(scrapeRuns)
    .orderBy(scrapeRuns.source, desc(scrapeRuns.startedAt));
  return SOURCE_KEYS.map((k) => runs.find((r) => r.source === k))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({
      source: r.source,
      status: r.status,
      found: r.found,
      matched: r.matched,
      message: r.message,
      finishedAt: r.finishedAt?.toISOString() ?? null,
    }));
}

export interface HistoryPoint {
  day: string;
  libero: number;
  min: number | null;
  /** Every site's price that day, sold out or not. */
  prices: Record<string, number>;
  /** Sites whose price that day was for an out-of-stock listing. */
  out: string[];
}

/** Daily Libero vs competitor prices for one product (the chart in the product drawer). */
export async function getHistory(productId: number, days = 120): Promise<HistoryPoint[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.productId, productId))
    .orderBy(desc(snapshots.day))
    .limit(days);
  return rows.reverse().map((r) => ({
    day: r.day,
    libero: r.liberoPrice,
    min: r.minPrice,
    prices: Object.fromEntries(Object.entries(r.prices).map(([k, v]) => [k, v.p])),
    out: Object.entries(r.prices).filter(([, v]) => !v.st).map(([k]) => k),
  }));
}
