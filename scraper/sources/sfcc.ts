import * as cheerio from "cheerio";
import type { SourceKey } from "../../src/lib/config";
import { barcodeOf, decodeEntities, getHtml, jitter } from "../lib/http";
import { parseTitle } from "../lib/perfume";
import type { CompetitorItem, Source } from "../types";

// Salesforce Commerce Cloud (Onlys): the grid endpoint Search-UpdateGrid returns the product
// tiles for a category, ?start=N&sz=100. Each tile has the brand, the full name (image alt),
// the size line, sale and list price, an out-of-stock class, and the EAN in the image path.

const PAGE_SIZE = 100;
const MAX_PAGES = 60;

export function sfccSource(key: SourceKey, base: string, site: string, category: string): Source {
  return {
    key,
    async run() {
      const byId = new Map<string, CompetitorItem>();
      const warnings: string[] = [];
      let page = 0;
      for (; page < MAX_PAGES; page++) {
        const html = await getHtml(
          `${base}/on/demandware.store/Sites-${site}-Site/iw_IL/Search-UpdateGrid?cgid=${category}&start=${page * PAGE_SIZE}&sz=${PAGE_SIZE}`,
        );
        const $ = cheerio.load(html);
        const before = byId.size;
        $("div.product[data-pid]").each((_, el) => {
          const tile = $(el);
          const id = tile.attr("data-pid")!;
          const price = Number(tile.find(".prices .sales .value").first().attr("content"));
          if (!(price > 0)) return;
          const regular = Number(tile.find(".prices .strike-through .value").first().attr("content"));
          const img = tile.find("img.tile-image").first();
          const brand = tile.find(".brand-name").first().text().replace(/\s+/g, " ").trim() || null;
          let name = decodeEntities(img.attr("alt") || tile.find(".product-name").first().text()).replace(/\s+/g, " ").trim();
          const size = /\d+(?:[.,]\d+)?\s*(?:מ"ל|ml)/i.exec(tile.find(".productUnitDescription").first().text())?.[0];
          if (size && parseTitle(name).ml == null) name += ` ${size}`;
          const href = tile.find("a.product-link, .pdp-link a").first().attr("href") ?? "";
          const gtm = tile.find("[data-gtmdata]").first().attr("data-gtmdata") ?? "";
          byId.set(id, {
            source: key,
            externalId: id,
            url: new URL(href, base).toString(),
            title: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name,
            brand,
            barcode: barcodeOf(/\/images\/(\d{8,14})\//.exec(img.attr("src") ?? "")?.[1]),
            price: Math.round(price),
            regularPrice: regular > price ? Math.round(regular) : null,
            inStock: !tile.find(".oosProduct").length && !/"stock_status":"Out of stock"/.test(gtm),
            image: img.attr("src") ?? null,
          });
        });
        if (byId.size === before) break;
        await jitter(900, 1800);
      }
      if (page === MAX_PAGES) warnings.push(`stopped at ${MAX_PAGES} pages`);
      return { items: [...byId.values()], warnings };
    },
  };
}
