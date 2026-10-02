import * as cheerio from "cheerio";
import { barcodeOf, decodeEntities, getHtml, jitter, parseShekels } from "../lib/http";
import type { CompetitorItem, Source } from "../types";

// Jonathan (Magento 1, niche perfumery). Category cards show only the scent name ("Avanguardia"),
// the brand and a price; the size, EAN and stock live on the product page. So: list every
// category, then read each product page with a few requests in flight. A single-size page has
// the size as the selected <option> and one JSON-LD offer; a multi-size page has a
// Product.Config JSON (size, price, child id per option) and one JSON-LD offer per size.

const BASE = "https://www.jonathan.co.il";
const CATEGORIES = ["womens-perfume", "mens-fragrance", "unisex-fragrances", "niche-fragrances"];
const MAX_PAGES = 60;
const WORKERS = 3;

interface Listed {
  url: string;
  name: string;
  brand: string | null;
  price: number | null;
  image: string | null;
}

export function jonathanSource(): Source {
  return {
    key: "jonathan",
    async run() {
      const listed = new Map<string, Listed>();
      const warnings: string[] = [];
      for (const category of CATEGORIES) {
        for (let page = 1; page <= MAX_PAGES; page++) {
          const $ = cheerio.load(await getHtml(`${BASE}/${category}?limit=36&p=${page}`));
          const before = listed.size;
          let cards = 0;
          $(".products-grid li.item").each((_, el) => {
            const card = $(el);
            const link = card.find(".product-name a").first();
            const url = link.attr("href")?.trim();
            const price = parseShekels(card.find(".price-box .special-price .price, .price-box .regular-price .price").first().text());
            cards++;
            if (!url) return;
            listed.set(url, {
              url,
              name: decodeEntities(link.text().replace(/\s+/g, " ").trim()),
              brand: card.find(".manufacturer-link").first().text().trim() || null,
              price,
              image: card.find("img").first().attr("data-src") ?? null,
            });
          });
          // Past the last page Magento repeats it: nothing new means this category is done.
          if (!cards || listed.size === before) break;
          await jitter(800, 1500);
        }
      }

      const items: CompetitorItem[] = [];
      let failed = 0;
      const queue = [...listed.values()];
      await Promise.all(
        Array.from({ length: WORKERS }, async () => {
          for (let p = queue.shift(); p; p = queue.shift()) {
            try {
              items.push(...parseProductPage(await getHtml(p.url), p));
            } catch {
              failed++;
            }
            await jitter(400, 1000);
          }
        }),
      );
      if (failed) warnings.push(`${failed}/${listed.size} product pages failed`);
      return { items, warnings };
    },
  };
}

interface LdOffer {
  "@type"?: string;
  price?: number | string;
  availability?: string;
  sku?: string;
}
interface LdProduct {
  "@type"?: string;
  sku?: string;
  offers?: LdOffer[] | LdOffer;
}
interface ConfigOption {
  label: string;
  price: string;
  oldPrice?: string;
  products: string[];
}

function parseProductPage(html: string, listed: Listed): CompetitorItem[] {
  const $ = cheerio.load(html);
  let ld: LdProduct | undefined;
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const data = JSON.parse($(el).text()) as LdProduct;
      if (data["@type"] === "Product") ld = data;
    } catch {
      // other JSON-LD blocks (breadcrumbs, organisation) may be malformed; not needed
    }
  });
  const allOffers = ld?.offers ? (Array.isArray(ld.offers) ? ld.offers : [ld.offers]) : [];
  const offers = allOffers.filter((o) => o["@type"] !== "AggregateOffer");
  const inStock = (o: LdOffer | undefined) => (o?.availability ? /InStock/i.test(o.availability) : true);
  const item = (id: string, size: string, price: number, old: number | null, barcode: string | null | undefined, stock: boolean): CompetitorItem => ({
    source: "jonathan",
    externalId: id,
    url: listed.url,
    title: [listed.brand, listed.name, size].filter(Boolean).join(" "),
    brand: listed.brand,
    barcode: barcodeOf(barcode),
    price,
    regularPrice: old && old > price ? old : null,
    inStock: stock,
    image: listed.image,
  });

  // Multi-size: one item per size option.
  const config = /new Product\.Config\((\{.*?\})\);/.exec(html)?.[1];
  if (config) {
    try {
      const attrs = Object.values((JSON.parse(config) as { attributes: Record<string, { options: ConfigOption[] }> }).attributes);
      const options = attrs.length === 1 ? attrs[0].options : [];
      // The JSON-LD lists one offer per size in the same order when the counts agree.
      const aligned = offers.length === options.length;
      return options
        .map((o, i) => {
          const price = Math.round(Number(o.price));
          if (!(price > 0)) return null;
          const offer = aligned ? offers[i] : offers.find((x) => Math.round(Number(x.price)) === price);
          const stock = offer ? inStock(offer) : inStock(allOffers[0]);
          return item(o.products[0] ?? `${listed.url}#${o.label}`, decodeEntities(o.label), price, Math.round(Number(o.oldPrice)) || null, offer?.sku, stock);
        })
        .filter((x): x is CompetitorItem => x !== null);
    } catch {
      // fall through to the single-size reading
    }
  }

  const offer = offers[0];
  const sizeSelect = $("dt:contains('גודל')").next("dd").find("select").first();
  const size = (sizeSelect.find("option[selected]").first().text() || sizeSelect.find("option").first().text()).replace(/\s+/g, " ").trim();
  const price = Math.round(Number(offer?.price)) || listed.price;
  if (!price) return [];
  const id = /product-price-(\d+)/.exec(html)?.[1] ?? listed.url;
  return [item(id, size, price, listed.price, offer?.sku ?? ld?.sku, inStock(offer))];
}
