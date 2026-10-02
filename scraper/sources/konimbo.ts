import * as cheerio from "cheerio";
import type { SourceKey } from "../../src/lib/config";
import { barcodeOf, getHtml, jitter, parseShekels } from "../lib/http";
import type { CompetitorItem, Source } from "../types";

// Konimbo (Israeli store platform): server-rendered category pages, 30 items per page, ?page=N.
// Each card carries data-item-code (barcode), data-brand-title, the title, prices and a
// hidden stock_state. Requests need a same-site Referer or Konimbo serves a redirect stub.

const MAX_PAGES = 260;

/**
 * How the store marks stock on cards. "state": the hidden stock_state span (Odem).
 * "icon": stock_state is always "out_of_stock" and the real signal is the sold-out icon (Novo Pharm).
 */
type StockSignal = "state" | "icon";

export function konimboSource(key: SourceKey, base: string, categories: string[], stock: StockSignal = "state"): Source {
  return {
    key,
    async run() {
      const byId = new Map<string, CompetitorItem>();
      const warnings: string[] = [];
      for (const category of categories) {
        let lastPage = 1;
        for (let page = 1; page <= Math.min(lastPage, MAX_PAGES); page++) {
          const html = await getHtml(`${base}/${category}${page > 1 ? `?page=${page}` : ""}`, {
            headers: { Referer: `${base}/` },
          });
          if (html.includes("limit_no_referer")) throw new Error("referer check page instead of the category");
          const $ = cheerio.load(html);
          const pages = $("a[href*='page=']")
            .map((_, a) => Number(/[?&]page=(\d+)/.exec($(a).attr("href") ?? "")?.[1] ?? 0))
            .get();
          lastPage = Math.max(lastPage, ...pages);

          const cards = $("div[id^='item_id_']");
          if (!cards.length) break;
          cards.each((_, el) => {
            const card = $(el);
            const id = card.attr("id")!.replace("item_id_", "");
            const title = card.find("h3.title").first().text().replace(/\s+/g, " ").trim();
            const price = parseShekels(card.find("p.price").first().text());
            if (!title || !price) return;
            const href = card.find("a[href*='/items/']").first().attr("href")?.trim() ?? `/items/${id}`;
            byId.set(id, {
              source: key,
              externalId: id,
              url: new URL(href, base).toString(),
              title,
              brand: card.attr("data-brand-title")?.trim() || null,
              barcode: barcodeOf(card.attr("data-item-code")),
              price,
              regularPrice: parseShekels(card.find("p.origin_price").first().text()),
              inStock:
                stock === "icon"
                  ? card.find(".sold_out_icon").length === 0
                  : card.find(".stock_state").first().text().trim() !== "out_of_stock",
              image: card.find("img").first().attr("src") ?? null,
            });
          });
          await jitter(900, 1800);
        }
        if (lastPage > MAX_PAGES) warnings.push(`${category}: ${lastPage} pages, read ${MAX_PAGES}`);
      }
      return { items: [...byId.values()], warnings };
    },
  };
}
