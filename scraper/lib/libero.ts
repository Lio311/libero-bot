import { EXCLUDED_CATEGORIES } from "../../src/lib/config";
import { barcodeOf, decodeEntities, getJson, sleep } from "./http";

// Libero's own catalog via WooCommerce REST v3 (consumer key/secret, read-only use).

export interface LiberoProduct {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  url: string;
  /** Current price (the sale price when one is active). */
  price: number;
  regularPrice: number | null;
  onSale: boolean;
  stockQty: number | null;
  categories: string[];
  image: string | null;
}

interface WcProduct {
  id: number;
  name: string;
  type: string;
  sku: string;
  permalink: string;
  price: string;
  regular_price: string;
  on_sale: boolean;
  stock_quantity: number | null;
  stock_status: string;
  categories: { name: string }[];
  images: { src: string }[];
}

const FIELDS = "id,name,type,sku,permalink,price,regular_price,on_sale,stock_quantity,stock_status,categories,images";

export async function fetchLiberoProducts(): Promise<{ products: LiberoProduct[]; excluded: number }> {
  const { WC_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET } = process.env;
  if (!WC_URL || !WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) throw new Error("WC_URL / WC_CONSUMER_KEY / WC_CONSUMER_SECRET not set");
  const auth = "Basic " + Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString("base64");

  const products: LiberoProduct[] = [];
  let excluded = 0;
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const { data, res } = await getJson<WcProduct[]>(
      `${WC_URL}/wp-json/wc/v3/products?status=publish&stock_status=instock&per_page=100&page=${page}&_fields=${FIELDS}`,
      { headers: { Authorization: auth } },
    );
    totalPages = Number(res.headers.get("x-wp-totalpages") ?? 1) || 1;
    for (const p of data) {
      const categories = p.categories.map((c) => decodeEntities(c.name));
      const price = Math.round(Number(p.price));
      if (p.type !== "simple" || !(price > 0) || categories.some((c) => EXCLUDED_CATEGORIES.includes(c))) {
        excluded++;
        continue;
      }
      products.push({
        id: p.id,
        name: decodeEntities(p.name).replace(/\s+/g, " ").trim(),
        sku: p.sku || null,
        barcode: barcodeOf(p.sku),
        url: p.permalink,
        price,
        regularPrice: Math.round(Number(p.regular_price)) || null,
        onSale: !!p.on_sale,
        stockQty: p.stock_quantity,
        categories,
        image: p.images?.[0]?.src ?? null,
      });
    }
    await sleep(400);
  }
  return { products, excluded };
}
