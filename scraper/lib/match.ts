import type { SourceKey } from "../../src/lib/config";
import type { CompetitorItem } from "../types";
import type { LiberoProduct } from "./libero";
import { clean, heSkeleton, parseTitle, tokensEqual, type ParsedTitle } from "./perfume";

// Matching rule (agreed with the owner): same scent name + same ml + same concentration,
// tester only against tester. A barcode match is a strong hint but still has to agree on
// ml and tester. Better to miss a match than to show a wrong one.

export type MatchMethod = "barcode" | "name";

export interface Match {
  productId: number;
  item: CompetitorItem;
  method: MatchMethod;
  /** 0..1, how much of the name agreed. 1 for barcode matches. */
  score: number;
  /** One side didn't state the concentration; matched on name + ml alone (no ambiguity). */
  concAssumed: boolean;
}

interface Prepared {
  parsed: ParsedTitle;
  /** Name tokens with brand words removed, per script. */
  en: string[];
  he: string[];
  brandEn: string | null;
  brandHe: string | null;
  brandDisplay: string | null;
}

// ---------- brand lexicon (learned from competitor brand fields) ----------

interface BrandAlias {
  tokens: string[];
  /** Human-readable brand as a site wrote it (for the dashboard's brand filter). */
  display: string;
}

export interface Lexicon {
  en: BrandAlias[];
  he: BrandAlias[];
}

const BRAND_NOISE = new Set(["perfume", "parfum", "בושם", "בשמים", "כללי", "general", "mist", "molecule", "unknown", "other", "אחר"]);

function brandTokens(s: string): { en: string[]; he: string[] } {
  const t = clean(s).replace(/[^0-9a-z֐-׿' ]+/g, " ");
  const en: string[] = [];
  const he: string[] = [];
  for (const w of t.split(" ").map((x) => x.replace(/^'+|'+$/g, "")).filter(Boolean)) {
    if (/[֐-׿]/.test(w)) he.push(heSkeleton(w));
    else en.push(w.replace(/'/g, ""));
  }
  return { en, he };
}

export function buildLexicon(items: CompetitorItem[]): Lexicon {
  const counts = new Map<string, number>();
  const add = (s: string) => {
    const k = s.trim();
    if (!k || BRAND_NOISE.has(clean(k))) return;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const i of items) {
    if (i.brand) i.brand.split(/\s[-–|/]\s|\s*\/\s*/).forEach(add);
    // "שם המוצר - מותג" (Mist, Perfume Center): the last dash-separated segment is the brand.
    const parts = i.title.split(/\s[-–]\s/);
    if (parts.length >= 2 && i.source !== "molecule") add(parts[parts.length - 1]);
  }
  const en = new Map<string, BrandAlias>();
  const he = new Map<string, BrandAlias>();
  // Most frequent spelling first, so it becomes the display name for its token key.
  for (const [name, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    if (n < 2) continue;
    const t = brandTokens(name);
    const display = name.replace(/\s+/g, " ").trim();
    const enName = display.replace(/[\u0590-\u05ff'"״׳]+/g, " ").replace(/\s+/g, " ").replace(/^[\s\-–]+|[\s\-–]+$/g, "");
    const heName = display.replace(/[A-Za-z]+/g, " ").replace(/\s+/g, " ").replace(/^[\s\-–]+|[\s\-–]+$/g, "");
    if (t.en.length && t.en.length <= 4 && t.en.join("").length >= 3 && !en.has(t.en.join(" ")))
      en.set(t.en.join(" "), { tokens: t.en, display: titleCase(enName || display) });
    // Hebrew aliases are consonant skeletons: a short one ("בס" from "בויס 1920") or one that lost
    // its digits would hit unrelated names, so require some substance and no numbers.
    if (t.he.length && t.he.length <= 4 && t.he.join("").length >= 3 && !/\d/.test(display) && !he.has(t.he.join(" ")))
      he.set(t.he.join(" "), { tokens: t.he, display: heName || display });
  }
  // Longest aliases first so "christian dior" wins over "dior".
  const sort = (m: Map<string, BrandAlias>) =>
    [...m.values()].sort((a, b) => b.tokens.length - a.tokens.length || b.tokens.join("").length - a.tokens.join("").length);
  return { en: sort(en), he: sort(he) };
}

/** "XERJOFF" / "kilian" → "Xerjoff" / "Kilian"; mixed-case names ("YSL", "Jean Paul Gaultier") stay. */
const titleCase = (s: string) =>
  s === s.toUpperCase() || s === s.toLowerCase() ? s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, c) => a + c.toUpperCase()) : s;

/** Removes the first (longest) brand alias found in the tokens; returns the brand key. */
function stripBrand(tokens: string[], aliases: BrandAlias[]): { rest: string[]; brand: string | null; display: string | null } {
  for (const { tokens: alias, display } of aliases) {
    for (let i = 0; i + alias.length <= tokens.length; i++) {
      if (alias.every((a, j) => tokens[i + j] === a)) {
        return { rest: [...tokens.slice(0, i), ...tokens.slice(i + alias.length)], brand: alias.join(" "), display };
      }
    }
  }
  return { rest: tokens, brand: null, display: null };
}

function prepare(title: string, lex: Lexicon): Prepared {
  const parsed = parseTitle(title);
  const en = stripBrand(parsed.en, lex.en);
  const he = stripBrand(parsed.he, lex.he);
  return { parsed, en: en.rest, he: he.rest, brandEn: en.brand, brandHe: he.brand, brandDisplay: en.display ?? he.display };
}

/** Brand name for display (English when the title has it), or null when no known brand appears. */
export function detectBrand(title: string, lex: Lexicon): string | null {
  return prepare(title, lex).brandDisplay;
}

const brandsConflict = (a: string | null, b: string | null) => {
  if (!a || !b || a === b) return false;
  const sa = a.split(" ");
  const sb = b.split(" ");
  // "dior" vs "christian dior" is the same brand.
  return !(sa.every((x) => sb.includes(x)) || sb.every((x) => sa.includes(x)));
};

// ---------- name comparison ----------

/** Greedy one-to-one fuzzy token matching; returns the number of matched pairs. */
function matchedPairs(a: string[], b: string[]): number {
  const used = new Set<number>();
  let m = 0;
  for (const x of a) {
    const j = b.findIndex((y, k) => !used.has(k) && tokensEqual(x, y));
    if (j >= 0) {
      used.add(j);
      m++;
    }
  }
  return m;
}

/**
 * Score for one script, or null when either side has no words in it.
 * Strict: every word of the shorter name must match, and the longer name may carry at most
 * one extra word (and only when it has 4+ words). "Joy" vs "Joy Intense" fails.
 */
function scriptScore(a: string[], b: string[]): { pass: boolean; score: number } | null {
  if (!a.length || !b.length) return null;
  const m = matchedPairs(a.length <= b.length ? a : b, a.length <= b.length ? b : a);
  const short = Math.min(a.length, b.length);
  const long = Math.max(a.length, b.length);
  const extra = long - m;
  const pass = m === short && (extra === 0 || (extra === 1 && long >= 4));
  return { pass, score: m / long };
}

const numbers = (p: Prepared) => p.parsed.en.filter((t) => /^\d+$/.test(t)).sort().join(",");

function nameScore(a: Prepared, b: Prepared): number {
  if (brandsConflict(a.brandEn, b.brandEn) || brandsConflict(a.brandHe, b.brandHe)) return 0;
  // Numbers in a name identify the scent ("1989", "No 3", "Reflection 45", "212"): both sides must agree.
  if (numbers(a) !== numbers(b)) return 0;
  const en = scriptScore(a.en, b.en);
  const he = scriptScore(a.he, b.he);
  const scored = [en, he].filter((s): s is { pass: boolean; score: number } => s !== null);
  if (!scored.length) return 0;
  // One script must pass; a script that clearly disagrees (under a third) vetoes.
  if (!scored.some((s) => s.pass) || scored.some((s) => s.score < 0.34)) return 0;
  return Math.max(...scored.filter((s) => s.pass).map((s) => s.score));
}

// ---------- matching ----------

const sizeKey = (p: ParsedTitle) => `${p.ml}|${p.tester ? 1 : 0}|${p.refill ? 1 : 0}`;

export interface MatchStats {
  liberoSkipped: number;
  competitorUsable: Record<string, number>;
}

/**
 * Finds, per Libero product and per competitor site, the best matching competitor item.
 * `rejected` holds "productId:source:externalId" pairs the owner marked as wrong.
 */
export function matchAll(
  products: LiberoProduct[],
  items: CompetitorItem[],
  rejected: Set<string> = new Set(),
): { matches: Match[]; stats: MatchStats; lexicon: Lexicon } {
  const lex = buildLexicon(items);
  const bySource = new Map<SourceKey, { index: Map<string, { item: CompetitorItem; prep: Prepared }[]>; byBarcode: Map<string, { item: CompetitorItem; prep: Prepared }[]> }>();
  const stats: MatchStats = { liberoSkipped: 0, competitorUsable: {} };

  for (const item of items) {
    const prep = prepare(item.title, lex);
    if (prep.parsed.excluded || prep.parsed.ml == null) continue;
    let s = bySource.get(item.source);
    if (!s) bySource.set(item.source, (s = { index: new Map(), byBarcode: new Map() }));
    const k = sizeKey(prep.parsed);
    (s.index.get(k) ?? s.index.set(k, []).get(k)!).push({ item, prep });
    if (item.barcode) (s.byBarcode.get(item.barcode) ?? s.byBarcode.set(item.barcode, []).get(item.barcode)!).push({ item, prep });
    stats.competitorUsable[item.source] = (stats.competitorUsable[item.source] ?? 0) + 1;
  }

  const matches: Match[] = [];
  for (const product of products) {
    const prep = prepare(product.name, lex);
    if (prep.parsed.excluded || prep.parsed.ml == null) {
      stats.liberoSkipped++;
      continue;
    }
    const pc = prep.parsed;
    for (const [source, s] of bySource) {
      const notRejected = (c: { item: CompetitorItem }) => !rejected.has(`${product.id}:${source}:${c.item.externalId}`);

      // 1) Barcode, confirmed by size and tester flag (and concentration when both state it).
      const byCode = (product.barcode ? s.byBarcode.get(product.barcode) ?? [] : []).filter(
        (c) =>
          notRejected(c) &&
          c.prep.parsed.ml === pc.ml &&
          c.prep.parsed.tester === pc.tester &&
          c.prep.parsed.refill === pc.refill &&
          !(c.prep.parsed.conc && pc.conc && c.prep.parsed.conc !== pc.conc),
      );
      if (byCode.length) {
        const best = pickCheapestInStock(byCode.map((c) => c.item));
        matches.push({ productId: product.id, item: best, method: "barcode", score: 1, concAssumed: false });
        continue;
      }

      // 2) Name + ml + concentration.
      const pool = (s.index.get(sizeKey(pc)) ?? []).filter(notRejected);
      const scored = pool
        .map((c) => {
          const cc = c.prep.parsed.conc;
          if (cc && pc.conc && cc !== pc.conc) return null;
          const score = nameScore(prep, c.prep);
          return score > 0 ? { c, score, concAssumed: !(cc && pc.conc) } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (!scored.length) continue;
      // If concentration had to be assumed, the candidates must not span several concentrations.
      const assumed = scored.filter((x) => x.concAssumed);
      if (assumed.length && new Set(scored.map((x) => x.c.prep.parsed.conc ?? "?")).size > 1 && !pc.conc) continue;
      const top = Math.max(...scored.map((x) => x.score));
      const best = scored.filter((x) => x.score === top);
      const item = pickCheapestInStock(best.map((x) => x.c.item));
      const chosen = best.find((x) => x.c.item === item)!;
      matches.push({ productId: product.id, item, method: "name", score: top, concAssumed: chosen.concAssumed });
    }
  }
  return { matches, stats, lexicon: lex };
}

/** Same product listed twice on one site: the in-stock, cheapest listing represents the site. */
function pickCheapestInStock(items: CompetitorItem[]): CompetitorItem {
  return [...items].sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.price - b.price)[0];
}
