import {
  pgTable,
  serial,
  text,
  integer,
  real,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";

/** Libero's in-stock catalog (WooCommerce), refreshed every run. */
export const products = pgTable(
  "products",
  {
    /** WooCommerce product id. */
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    sku: text("sku"),
    url: text("url").notNull(),
    image: text("image"),
    price: integer("price").notNull(),
    regularPrice: integer("regular_price"),
    onSale: boolean("on_sale").notNull().default(false),
    stockQty: integer("stock_qty"),
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    /** Detected from the name against brands the competitor sites list (null = unknown/house brand). */
    brand: text("brand"),
    /** Parsed from the name: size, concentration, tester flag (the matching keys). */
    ml: real("ml"),
    conc: text("conc"),
    tester: boolean("tester").notNull().default(false),
    /** In stock and part of the comparison in the latest run. */
    active: boolean("active").notNull().default(true),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** The owner chose to stop tracking this product (dashboard "ignore"). */
    ignoredAt: timestamp("ignored_at", { withTimezone: true }),
  },
  (t) => [index("products_active_idx").on(t.active)],
);

/** A competitor listing matched to a Libero product. One row per (product, site, listing). */
export const offers = pgTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull(),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    price: integer("price").notNull(),
    regularPrice: integer("regular_price"),
    inStock: boolean("in_stock").notNull(),
    /** "barcode" or "name". */
    method: text("method").notNull(),
    score: real("score").notNull(),
    /** The site didn't state the concentration; matched on name + size with no ambiguity. */
    concAssumed: boolean("conc_assumed").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** Last run that produced this match. Older than the source's last good run = superseded. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** The owner marked this as a wrong match; never matched again. */
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("offers_product_source_external_idx").on(t.productId, t.source, t.externalId),
    index("offers_product_idx").on(t.productId),
  ],
);

/** Per-site price inside a snapshot (short keys keep a year of history small). */
export interface SnapshotPrice {
  /** price */
  p: number;
  /** in stock */
  st: boolean;
  /** offers.id */
  o: number;
  /** stale: the site failed today, this is its last good reading */
  x?: boolean;
}

/** The daily comparison result per product: what the dashboard and the 08:00 email read. */
export const snapshots = pgTable(
  "snapshots",
  {
    /** Israel calendar day. */
    day: date("day").notNull(),
    productId: integer("product_id").notNull(),
    liberoPrice: integer("libero_price").notNull(),
    /** Cheapest in-stock competitor price (null = no in-stock match). */
    minPrice: integer("min_price"),
    minSource: text("min_source"),
    /** liberoPrice − minPrice. */
    gap: integer("gap"),
    /** pricier | cheaper | same | unmatched */
    verdict: text("verdict").notNull(),
    prices: jsonb("prices").$type<Record<string, SnapshotPrice>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day, t.productId] }), index("snapshots_product_idx").on(t.productId)],
);

export const scrapeRuns = pgTable(
  "scrape_runs",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** running | ok | blocked | skipped | error */
    status: text("status").notNull(),
    /** Items read from the site. */
    found: integer("found").notNull().default(0),
    /** Libero products matched on this site. */
    matched: integer("matched").notNull().default(0),
    message: text("message"),
  },
  (t) => [index("scrape_runs_source_started_idx").on(t.source, t.startedAt)],
);

/** Sent emails, so the 08:00 digest goes out once per day even when two cron slots fire. */
export const emailLog = pgTable(
  "email_log",
  {
    id: serial("id").primaryKey(),
    /** digest | alert */
    kind: text("kind").notNull(),
    day: date("day").notNull(),
    subject: text("subject").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_log_kind_day_idx").on(t.kind, t.day)],
);

export type Product = typeof products.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
