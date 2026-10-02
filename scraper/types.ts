import type { SourceKey } from "../src/lib/config";

/** One purchasable competitor item (a Shopify variant counts as its own item). */
export interface CompetitorItem {
  source: SourceKey;
  /** Stable id on that site (variant id, product id, Konimbo item id). */
  externalId: string;
  url: string;
  /** Full display title, including the variant (e.g. "... 100ml"). */
  title: string;
  brand?: string | null;
  /** EAN/UPC when the site exposes one. A hint only: sites sometimes use their own codes. */
  barcode?: string | null;
  /** Current price the customer pays (sale price included), whole shekels. */
  price: number;
  regularPrice?: number | null;
  inStock: boolean;
  image?: string | null;
}

export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedError";
  }
}

export interface SourceResult {
  items: CompetitorItem[];
  /** Non-fatal problems, e.g. one page failed. Shown on the dashboard status popover. */
  warnings: string[];
}

export type Source = {
  key: SourceKey;
  run: () => Promise<SourceResult>;
};
