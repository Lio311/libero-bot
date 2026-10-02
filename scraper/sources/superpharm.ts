import * as cheerio from "cheerio";
import { barcodeOf, getHtml, jitter, parseShekels } from "../lib/http";
import type { CompetitorItem, Source } from "../types";

// Super-Pharm (SAP Hybris): the perfume category is server-rendered, 30 cards per page,
// ?page=N from 0. Each card carries the EAN, brand, name, size, list and sale price and an
// out-of-stock flag. Out-of-stock items sort last; past the end the site repeats the last page.
// The pages are heavy (~2 MB), hence the slower pace.

const BASE = "https://shop.super-pharm.co.il";
const CATEGORY = "/cosmetics/perfumes/c/20110000";
const MAX_PAGES = 200;

export function superPharmSource(): Source {
  return {
    key: "superpharm",
    async run() {
      const byId = new Map<string, CompetitorItem>();
      const warnings: string[] = [];
      let page = 0;
      for (; page < MAX_PAGES; page++) {
        const $ = cheerio.load(await getHtml(`${BASE}${CATEGORY}?page=${page}`));
        const before = byId.size;
        $("a.item-box-link").each((_, el) => {
          const link = $(el);
          const box = link.find(".item-box").first();
          const id = box.attr("data-id");
          const price = Number(box.attr("data-discountPrice")) || Number(box.attr("data-price"));
          if (!id || !(price > 0)) return;
          const regular = Number(box.attr("data-price"));
          const size = link.find(".description-wrap span").first().text().replace(/\s+/g, " ").trim();
          const brand = link.attr("data-brand")?.trim() || null;
          byId.set(id, {
            source: "superpharm",
            externalId: id,
            url: new URL(link.attr("href") ?? `/p/${id}`, BASE).toString(),
            title: [brand, link.attr("data-name")?.trim(), size].filter(Boolean).join(" "),
            brand,
            barcode: barcodeOf(link.find("[data-ean]").first().attr("data-ean")),
            price: Math.round(price),
            regularPrice: regular > price ? Math.round(regular) : parseShekels(link.find(".old-price .shekels").first().text()),
            inStock: box.attr("data-oos") !== "true",
            image: box.find("img").first().attr("src") ?? null,
          });
        });
        if (byId.size === before) break;
        await jitter(1200, 2400);
      }
      if (page === MAX_PAGES) warnings.push(`stopped at ${MAX_PAGES} pages`);
      return { items: [...byId.values()], warnings };
    },
  };
}
