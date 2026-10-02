import type { SourceKey } from "../../src/lib/config";
import { barcodeOf, getJson, jitter } from "../lib/http";
import type { CompetitorItem, Source } from "../types";

// Shopify stores publish their whole catalog at /products.json (250 per page, page=N until empty).

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  available: boolean;
  sku: string | null;
  barcode?: string | null;
}
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  images: { src: string }[];
  variants: ShopifyVariant[];
}

const MAX_PAGES = 120;

export function shopifySource(key: SourceKey, base: string): Source {
  return {
    key,
    async run() {
      const items: CompetitorItem[] = [];
      const warnings: string[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data } = await getJson<{ products: ShopifyProduct[] }>(`${base}/products.json?limit=250&page=${page}`);
        if (!data.products?.length) break;
        for (const p of data.products) {
          for (const v of p.variants) {
            const price = Math.round(Number(v.price));
            if (!(price > 0)) continue;
            const variant = v.title && v.title !== "Default Title" ? ` ${v.title}` : "";
            items.push({
              source: key,
              externalId: String(v.id),
              url: `${base}/products/${p.handle}${p.variants.length > 1 ? `?variant=${v.id}` : ""}`,
              title: `${p.title}${variant}`,
              brand: p.vendor || null,
              barcode: barcodeOf(v.barcode) ?? barcodeOf(v.sku),
              price,
              regularPrice: v.compare_at_price ? Math.round(Number(v.compare_at_price)) || null : null,
              inStock: !!v.available,
              image: p.images?.[0]?.src ?? null,
            });
          }
        }
        if (page === MAX_PAGES) warnings.push(`stopped at ${MAX_PAGES} pages`);
        await jitter(800, 1600);
      }
      return { items, warnings };
    },
  };
}
