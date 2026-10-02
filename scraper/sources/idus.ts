import * as cheerio from "cheerio";
import type { SourceKey } from "../../src/lib/config";
import { barcodeOf, decodeEntities, getHtml, jitter } from "../lib/http";
import { parseTitle } from "../lib/perfume";
import type { CompetitorItem, Source } from "../types";

// Magento 2 stores on the Idus theme (Lilit, Beyond Skin). GraphQL is blocked by Cloudflare,
// the category pages are not: ?p=N&product_list_limit=36 (36 is the largest size the store
// accepts; anything else falls back to 12). Each card has the brand, the name, final and old
// price, a stock flag and often a volume swatch; the image file name usually starts with the EAN.

const PAGE_SIZE = 36;
const MAX_PAGES = 120;

export function idusSource(key: SourceKey, base: string, category: string): Source {
  return {
    key,
    async run() {
      const byId = new Map<string, CompetitorItem>();
      const warnings: string[] = [];
      let total = Infinity;
      let page = 1;
      for (; page <= MAX_PAGES && byId.size < total; page++) {
        const $ = cheerio.load(await getHtml(`${base}/${category}?p=${page}&product_list_limit=${PAGE_SIZE}`));
        total = Number($(".toolbar-number").first().text().trim()) || total;
        const before = byId.size;
        $("li[id^='product_category_']").each((_, el) => {
          const card = $(el);
          const id = card.attr("data-id");
          const price = Number(card.find("[data-price-type='finalPrice']").first().attr("data-price-amount"));
          if (!id || !(price > 0)) return;
          const old = Number(card.find("[data-price-type='oldPrice']").first().attr("data-price-amount"));
          const brand = decodeEntities(card.find(".product-brand").first().text().replace(/\s+/g, " ").trim()) || null;
          let name = decodeEntities(card.find(".product-name a").first().text().replace(/\s+/g, " ").trim());
          if (!name) return;
          const volume = card.find(".product-volume .value").first().text().trim();
          const unit = card.find(".product-unit .value").first().text().trim();
          if (volume && /^ml$|מ"ל/i.test(unit) && parseTitle(name).ml == null) name += ` ${volume}ml`;
          const image = card.find("img.product-image-photo").first().attr("src") ?? null;
          byId.set(id, {
            source: key,
            externalId: id,
            url: card.find("a.product_link").first().attr("href") ?? `${base}/${id}`,
            title: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name,
            brand,
            barcode: barcodeOf(/\/(\d{8,14})(?:_[^/]*)?\.\w+$/.exec(image ?? "")?.[1]),
            price: Math.round(price),
            regularPrice: old > price ? Math.round(old) : null,
            inStock: card.find("form[product_outofstock]").first().attr("product_outofstock") !== "true",
            image,
          });
        });
        if (byId.size === before) break;
        await jitter(900, 1800);
      }
      if (page > MAX_PAGES && byId.size < total) warnings.push(`stopped at ${MAX_PAGES} pages (${byId.size}/${total})`);
      return { items: [...byId.values()], warnings };
    },
  };
}
