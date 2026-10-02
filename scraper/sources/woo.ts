import type { SourceKey } from "../../src/lib/config";
import { barcodeOf, decodeEntities, getJson, jitter } from "../lib/http";
import type { CompetitorItem, Source } from "../types";

// WooCommerce Store API: public, no keys. /wp-json/wc/store/v1/products, 100 per page,
// prices in minor units (agorot), X-WP-TotalPages header for pagination.

interface StoreProduct {
  id: number;
  name: string;
  type: string;
  permalink: string;
  sku: string;
  prices: { price: string; regular_price: string; sale_price: string; currency_minor_unit: number };
  is_in_stock: boolean;
  is_purchasable: boolean;
  images: { src: string }[];
  brands?: { name: string }[];
}

const MAX_PAGES = 150;

export function wooSource(key: SourceKey, base: string): Source {
  return {
    key,
    async run() {
      const items: CompetitorItem[] = [];
      const warnings: string[] = [];
      let totalPages = 1;
      for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
        const { data, res } = await getJson<StoreProduct[]>(
          `${base}/wp-json/wc/store/v1/products?per_page=100&page=${page}&orderby=id&order=asc`,
        );
        totalPages = Number(res.headers.get("x-wp-totalpages") ?? 1) || 1;
        for (const p of data) {
          const unit = 10 ** (p.prices?.currency_minor_unit ?? 2);
          const price = Math.round(Number(p.prices?.price) / unit);
          if (!(price > 0)) continue; // variable products without a single price, free gifts
          const regular = Math.round(Number(p.prices?.regular_price) / unit);
          items.push({
            source: key,
            externalId: String(p.id),
            url: p.permalink,
            title: decodeEntities(p.name),
            brand: p.brands?.[0]?.name ? decodeEntities(p.brands[0].name) : null,
            barcode: barcodeOf(p.sku),
            price,
            regularPrice: regular > 0 ? regular : null,
            inStock: !!p.is_in_stock,
            image: p.images?.[0]?.src ?? null,
          });
        }
        await jitter(700, 1500);
      }
      if (totalPages > MAX_PAGES) warnings.push(`catalog has ${totalPages} pages, read ${MAX_PAGES}`);
      return { items, warnings };
    },
  };
}
