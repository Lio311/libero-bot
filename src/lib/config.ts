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
  superpharm: { name: "Super-Pharm", he: "סופר-פארם", url: "https://shop.super-pharm.co.il", color: "var(--site-superpharm)" },
  myperfume: { name: "My Perfume", he: "מיי פרפיום", url: "https://www.myperfume.co.il", color: "var(--site-myperfume)" },
  callperfume: { name: "Call Perfume", he: "קול פרפיום", url: "https://callperfume.co.il", color: "var(--site-callperfume)" },
  perfumex: { name: "Perfumex", he: "פרפיומקס", url: "https://www.perfumex.co.il", color: "var(--site-perfumex)" },
  motagim: { name: "Beauty Shop Motagim", he: "ביוטי שופ מותגים", url: "https://www.beautyshopmotagim.co.il", color: "var(--site-motagim)" },
  perfumeclub: { name: "Perfume Club", he: "פרפיום קלאב", url: "https://perfumeclub.co.il", color: "var(--site-perfumeclub)" },
  blendo: { name: "Blendo", he: "בלנדו", url: "https://blendo.co.il", color: "var(--site-blendo)" },
  oligarch: { name: "Oligarch", he: "אוליגרך", url: "https://oligarch.co.il", color: "var(--site-oligarch)" },
  jonathan: { name: "Jonathan", he: "ג'ונתן", url: "https://www.jonathan.co.il", color: "var(--site-jonathan)" },
  lovenmour: { name: "Love n' Mour", he: "לאב אנד מור", url: "https://www.lovenmour.co.il", color: "var(--site-lovenmour)" },
  perfumeil: { name: "Perfume IL", he: "פרפיום IL", url: "https://www.perfumeil.co.il", color: "var(--site-perfumeil)" },
  lilit: { name: "Lilit", he: "לילית", url: "https://www.lilit.co.il", color: "var(--site-lilit)" },
  chozen: { name: "Chozen", he: "צ'וזן", url: "https://chozen.co.il", color: "var(--site-chozen)" },
  maryshop: { name: "Mary Shop", he: "מרי שופ", url: "https://maryshop.co.il", color: "var(--site-maryshop)" },
  beyondskin: { name: "Beyond Skin", he: "ביונד סקין", url: "https://www.beyondskin.co.il", color: "var(--site-beyondskin)" },
  glam42: { name: "Glam42", he: "גלאם 42", url: "https://glam42.co.il", color: "var(--site-glam42)" },
  mashbir: { name: "Mashbir 365", he: "המשביר 365", url: "https://365mashbir.co.il", color: "var(--site-mashbir)" },
  onlys: { name: "Onlys", he: "אונליס", url: "https://www.onlys.co.il", color: "var(--site-onlys)" },
  cosmeticclub: { name: "Cosmetic Club", he: "קוסמטיק קלאב", url: "https://www.cosmetic-club.co.il", color: "var(--site-cosmeticclub)" },
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
