// Comparison rules and competitor metadata shared by the scraper, the email and the dashboard.

/** A gap within ±this many shekels counts as "same price". */
export const SAME_PRICE_BAND = 20;

export type Verdict = "pricier" | "cheaper" | "same" | "unmatched";

export const VERDICT_LABEL: Record<Verdict, string> = {
  pricier: "ליברו יקרים יותר",
  cheaper: "ליברו זולים יותר",
  same: "מחיר זהה",
  unmatched: "לא נמצא אצל מתחרים",
};

/** gap = Libero price − cheapest in-stock competitor price. */
export function verdictFor(gap: number | null): Verdict {
  if (gap == null) return "unmatched";
  if (gap > SAME_PRICE_BAND) return "pricier";
  if (gap < -SAME_PRICE_BAND) return "cheaper";
  return "same";
}

export const SOURCES = {
  mist: { name: "Mist", he: "מיסט", url: "https://mist.co.il", color: "var(--site-mist)" },
  molecule: { name: "Molecule", he: "מולקול", url: "https://molecule-perfume.co.il", color: "var(--site-molecule)" },
  lolaray: { name: "Lola Ray", he: "לולה ריי", url: "https://lolaray.co.il", color: "var(--site-lolaray)" },
  perfumecenter: { name: "Perfume Center", he: "פרפיום סנטר", url: "https://perfumecenter.co.il", color: "var(--site-perfumecenter)" },
  kolboyehuda: { name: "Kolbo Yehuda", he: "כלבו יהודה", url: "https://kolboyehuda.co.il", color: "var(--site-kolboyehuda)" },
  odem: { name: "Odem", he: "אודם", url: "https://www.odemc.co.il", color: "var(--site-odem)" },
  novopharm: { name: "Novo Pharm", he: "נובו פארם", url: "https://www.novo-pharm.co.il", color: "var(--site-novopharm)" },
} as const;

export type SourceKey = keyof typeof SOURCES;

export const SOURCE_KEYS = Object.keys(SOURCES) as SourceKey[];

/** Libero's own store (WooCommerce REST v3 with keys). */
export const LIBERO_NAME = "ליברו";

/**
 * Libero categories left out of the comparison: minis, samples, bundles and accessories
 * almost never match one-to-one. Testers stay (compared to competitor testers only).
 */
export const EXCLUDED_CATEGORIES = [
  "מיני בושם",
  "דוגמיות",
  "משלוח דוגמיות",
  "חבילות בהרכבה אישית",
  "חבילות בישום",
  "חבילות הבית",
  "מוצרים נלווים",
  "דיופים",
];

/** A competitor price not refreshed for this long (its source kept failing) is ignored. */
export const STALE_AFTER_DAYS = 3;

/** Israel calendar day (YYYY-MM-DD) for snapshots and the 08:00 digest. */
export function israelDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
