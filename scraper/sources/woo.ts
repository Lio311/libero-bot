import type { SourceKey } from "../../src/lib/config";
import { barcodeOf, decodeEntities, getJson, jitter } from "../lib/http";
import { parseTitle } from "../lib/perfume";
import type { CompetitorItem, Source } from "../types";

// WooCommerce Store API: public, no keys. /wp-json/wc/store/v1/products, 100 per page,
// prices in minor units (agorot), X-WP-TotalPages header for pagination.
// Variable products (sizes / tester as variations) are replaced by their variations, read
// from the same endpoint with type=variation: the parent's price is only the cheapest one.
// Some stores keep the size out of the name and in a product attribute ("נפח: 100 מ"ל", Blendo);
// a single-valued size / concentration attribute is appended to such names.

interface StoreProduct {
  id: number;
  name: string;
  type: string;
  parent?: number;
  /** Variations only: "גודל: 100ml" or "סוג: Eau De Parfum Spray 77 ml, ..." */
  variation?: string;
  permalink: string;
  sku: string;
  prices: { price: string; regular_price: string; sale_price: string; currency_minor_unit: number };
  is_in_stock: boolean;
  is_purchasable: boolean;
  images: { src: string }[];
  brands?: { name: string }[];
  attributes?: { name: string; terms?: { name: string }[] }[];
}

const MAX_PAGES = 150;
const MAX_VARIATION_PAGES = 150;

function toItem(key: SourceKey, p: StoreProduct, title: string, brand: string | null): CompetitorItem | null {
  const unit = 10 ** (p.prices?.currency_minor_unit ?? 2);
  const price = Math.round(Number(p.prices?.price) / unit);
  if (!(price > 0)) return null; // variable products without a single price, free gifts
  const regular = Math.round(Number(p.prices?.regular_price) / unit);
  return {
    source: key,
    externalId: String(p.id),
    url: p.permalink,
    title,
    brand,
    barcode: barcodeOf(p.sku),
    price,
    regularPrice: regular > 0 ? regular : null,
    inStock: !!p.is_in_stock,
    image: p.images?.[0]?.src ?? null,
  };
}

const SIZE_ATTRIBUTE = /נפח|גודל|size|volume|ריכוז|concentration/i;

/** Name plus single-valued size / concentration attributes, when the name has no size of its own. */
function nameWithAttributes(p: StoreProduct): string {
  const name = decodeEntities(p.name);
  if (parseTitle(name).ml != null) return name;
  const extra = (p.attributes ?? [])
    .filter((a) => SIZE_ATTRIBUTE.test(a.name) && a.terms?.length === 1)
    .map((a) => decodeEntities(a.terms![0].name));
  return extra.length ? `${name} ${extra.join(" ")}` : name;
}

/** "גודל: tester-100ml, סוג: EDP" → "tester 100ml EDP" (attribute labels dropped). */
const variationText = (v: string | undefined) =>
  decodeEntities(v ?? "")
    .split(/,\s*/)
    .map((part) => part.replace(/^[^:]{1,40}:\s*/, "").replace(/-/g, " "))
    .join(" ");

export function wooSource(key: SourceKey, base: string): Source {
  const api = `${base}/wp-json/wc/store/v1/products?per_page=100&orderby=id&order=asc`;
  return {
    key,
    async run() {
      const items: CompetitorItem[] = [];
      const warnings: string[] = [];
      /** Variable parents: their own listing is kept only if no variation comes back. */
      const parents = new Map<number, { item: CompetitorItem | null; name: string; brand: string | null }>();
      let totalPages = 1;
      for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
        const { data, res } = await getJson<StoreProduct[]>(`${api}&page=${page}`);
        totalPages = Number(res.headers.get("x-wp-totalpages") ?? 1) || 1;
        for (const p of data) {
          const name = decodeEntities(p.name);
          const brand = p.brands?.[0]?.name ? decodeEntities(p.brands[0].name) : null;
          const item = toItem(key, p, p.type === "variable" ? name : nameWithAttributes(p), brand);
          if (p.type === "variable") parents.set(p.id, { item, name, brand });
          else if (item) items.push(item);
        }
        await jitter(700, 1500);
      }
      if (totalPages > MAX_PAGES) warnings.push(`catalog has ${totalPages} pages, read ${MAX_PAGES}`);

      const expanded = new Set<number>();
      if (parents.size) {
        try {
          let varPages = 1;
          for (let page = 1; page <= Math.min(varPages, MAX_VARIATION_PAGES); page++) {
            const { data, res } = await getJson<StoreProduct[]>(`${api}&type=variation&page=${page}`);
            varPages = Number(res.headers.get("x-wp-totalpages") ?? 1) || 1;
            const variations = data.filter((v) => v.type === "variation");
            if (page === 1 && !variations.length) throw new Error("type=variation returned no variations");
            for (const v of variations) {
              const parent = parents.get(v.parent ?? 0);
              const name = parent?.name ?? decodeEntities(v.name);
              const item = toItem(key, v, `${name} ${variationText(v.variation)}`.trim(), parent?.brand ?? null);
              if (!item) continue;
              items.push(item);
              if (v.parent) expanded.add(v.parent);
            }
            await jitter(700, 1500);
          }
          if (varPages > MAX_VARIATION_PAGES) warnings.push(`variations: ${varPages} pages, read ${MAX_VARIATION_PAGES}`);
        } catch (e) {
          warnings.push(`variations not read (${(e as Error).message}); variable products listed at their lowest price`);
        }
      }
      for (const [id, p] of parents) if (!expanded.has(id) && p.item) items.push(p.item);
      return { items, warnings };
    },
  };
}
