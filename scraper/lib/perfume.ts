// Parses perfume product titles (Hebrew, English or both) into comparable parts:
// size, concentration, tester/refill flags, and name tokens split by script.

export type Concentration = "extrait" | "parfum" | "edp" | "edt" | "edc";

export interface ParsedTitle {
  ml: number | null;
  conc: Concentration | null;
  tester: boolean;
  refill: boolean;
  /** Not a single full bottle: gift set, sample, decant, body/hair product. Never matched. */
  excluded: string | null;
  /** Normalized name tokens, Hebrew and Latin kept apart (sites differ in which they show). */
  he: string[];
  en: string[];
}

const BIDI = /[‎‏‪-‮⁦-⁩]/g;

/** Lowercase, unify quotes/dashes, strip accents and bidi marks. */
export function clean(s: string): string {
  return s
    .replace(BIDI, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // Latin accents (é → e); Hebrew points too
    .toLowerCase()
    .replace(/[״“”„]/g, '"')
    .replace(/[׳‘’`´]/g, "'")
    .replace(/[–—־]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const ML = /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:ml\b|m\.l\b|m\b|מ"ל|מ''ל|מ'ל|מל(?![֐-׿])|מיליליטר|מ\s"ל)/g;

function parseMl(t: string): number | null {
  const sizes = [...t.matchAll(ML)].map((m) => Number(m[1].replace(",", ".")));
  const valid = sizes.filter((n) => n >= 1 && n <= 1000);
  return valid.length ? valid[0] : null;
}

// Order matters: the most specific phrase wins (extrait before parfum, eau de parfum before parfum).
const CONC: [Concentration, RegExp][] = [
  ["extrait", /extrait|\bextract\b|אקסטרייט|אקסטרט|אקסטריט|אקסטרה?יט|אקסטרקט/],
  ["edp", /eau de parfum|eau du parfum|\be\.?d\.?p\b|אדפ|א\.ד\.פ|א"ד"פ|או דה פרפיום|או דה פרפום|אדו פרפיום|או דו פרפיום|אאו דה פרפיום/],
  ["edt", /eau de toilette|\be\.?d\.?t\b|אדט|א\.ד\.ט|או דה טואלט|אדו טואלט|או דו טואלט|אאו דה טואלט/],
  ["edc", /eau de cologne|\be\.?d\.?c\b|\bcologne\b|קולון|או דה קולון|אדק/],
  // Pure parfum: "parfum" on its own (not "parfums" the brand word, not "le parfum" names).
  ["parfum", /(?<!le |eau de |eau du |extrait de |de )\bparfum\b(?!s)|(?<![֐-׿])פרפיום(?![֐-׿])(?!.*(?:דה מרלי|דה מארלי))/],
];

function parseConc(t: string): Concentration | null {
  for (const [c, re] of CONC) if (re.test(t)) {
    // Hebrew "פרפיום" alone is ambiguous (brand names, "le parfum"); only trust it with no other signal.
    return c;
  }
  return null;
}

const TESTER = /tester|טסטר/;
const REFILL = /refill|ריפיל|(?<![֐-׿])מילוי(?![֐-׿])/;

/** Whole Hebrew words only: "סט" must not fire inside "דאסט" (Dust) or "ויאל" inside "רויאל" (Royal). */
const heWords = (...ws: string[]) => `(?<![\\u0590-\\u05ff])(?:${ws.join("|")})(?![\\u0590-\\u05ff])`;
const EXCLUDE: [string, RegExp][] = [
  ["set", new RegExp(`${heWords("מארז", "ומארז", "סט", "ערכת", "ערכה")}|gift set|\\bset\\b|\\bkit\\b|coffret|\\+\\s*(?:edp |edt )?\\d+\\s*(?:ml|מ"ל|מל)`)],
  ["sample", new RegExp(`${heWords("דוגמית", "דוגמא", "דוגמה", "ויאל", "דקאנט", "מיני", "טרבל", "מיניאטורה")}|\\bsamples?\\b|\\bvial\\b|\\bdecant\\b|\\bmini\\b|\\btravel\\b`)],
  ["body", new RegExp(`${heWords("גוף", "לגוף", "שיער", "לשיער", "דאודורנט", "לושן", "קרם", "סבון", "שמן", "מבשם", "נר", "מפיץ", "באלם", "מסקרה", "שפתון", "איפור", "פאונדיישן", "תחליב")}|ג'ל רחצה|ספריי לבית|תרסיס לבית|אפטר שייב|\\bbody\\b|\\bhair\\b|\\bdeo(?:dorant)?\\b|\\blotion\\b|\\bcream\\b|\\bshower\\b|\\bsoap\\b|\\boil\\b|\\bcandle\\b|\\bdiffuser\\b|room spray|after shave|\\bbalm\\b|\\blipstick\\b|\\bmakeup\\b|\\bfoundation\\b`)],
];

// Words that describe the product type, gender or size rather than identify the scent.
const STOP = new Set([
  // English
  "eau", "de", "du", "parfum", "toilette", "cologne", "extrait", "edp", "edt", "edc", "spray", "vaporisateur",
  "natural", "for", "men", "women", "woman", "man", "unisex", "ml", "tester", "refill", "perfume", "fragrance",
  "the", "and", "&", "by", "new", "box", "no", "with", "without", "cap", "oz", "fl", "intensely", "concentree",
  // Hebrew
  "בושם", "בשם", "לגבר", "לגברים", "לאישה", "לאשה", "לנשים", "יוניסקס", "גבר", "אישה", "נשים", "גברים", "טסטר", "מל",
  "או", "דה", "דו", "אדפ", "אדט", "פרפיום", "טואלט", "קולון", "אקסטרייט", "אקסטרט", "תרסיס", "ספריי", "ללא", "קופסא",
  "קופסה", "מכסה", "עם", "בלי", "ריפיל", "חדש", "מקורי", "של", "מבית",
]);

/** Hebrew spelling skeleton: transliterations vary (סוואז'/סובאז', ונילה/ואניל, קריד/כריד). */
export function heSkeleton(w: string): string {
  let s = w
    .replace(/['"]/g, "")
    .replace(/ך/g, "כ").replace(/ם/g, "מ").replace(/ן/g, "נ").replace(/ף/g, "פ").replace(/ץ/g, "צ")
    .replace(/^ו/, "ב") // word-initial vav is a "v"
    .replace(/וו/g, "ב")
    .replace(/(?!^)ו/g, "") // remaining vav: a vowel
    .replace(/[יאע]/g, "")
    .replace(/ה$/, "")
    .replace(/ת/g, "ט")
    .replace(/כ/g, "ק")
    .replace(/ש/g, "ס");
  if (!s) s = w;
  return s;
}

export function parseTitle(raw: string): ParsedTitle {
  const t = clean(raw);
  const ml = parseMl(t);
  const conc = parseConc(t);
  const tester = TESTER.test(t);
  const refill = REFILL.test(t);
  const excluded = EXCLUDE.find(([, re]) => re.test(t))?.[0] ?? null;

  const body = t
    .replace(ML, " ")
    .replace(/\d+(?:[.,]\d+)?\s*(?:oz|fl\.?\s*oz)\b/g, " ")
    .replace(/eau de parfum|eau de toilette|eau de cologne|extrait de parfum|או דה פרפיום|או דה טואלט|אקסטרייט דה פרפיום/g, " ")
    .replace(/\b[a-z](?:\.[a-z])+\.?/g, " ") // e.d.p / a.d.p style abbreviations
    .replace(/[א-ת](?:\.[א-ת])+\.?/g, " ")
    .replace(/[^0-9a-z֐-׿' ]+/g, " ");
  const he: string[] = [];
  const en: string[] = [];
  for (const w of body.split(" ")) {
    const word = w.replace(/^'+|'+$/g, "");
    if (!word || STOP.has(word) || STOP.has(word.replace(/'/g, ""))) continue;
    if (/[֐-׿]/.test(word)) {
      // Hebrew prefixes "ו"/"ה" on stop words ("והבושם") are rare in titles; keep words as-is.
      if (word.length < 2) continue;
      he.push(heSkeleton(word));
    } else if (/^\d+$/.test(word)) {
      // Numbers are part of names ("212", "1 million", "9pm" splits to 9 + pm); keep them.
      en.push(word);
    } else {
      en.push(word.replace(/'/g, ""));
    }
  }
  return { ml, conc, tester, refill, excluded, he: dedupe(he), en: dedupe(en) };
}

const dedupe = (xs: string[]) => [...new Set(xs)];

/** Levenshtein distance with an early exit above `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export function tokensEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return false; // 212 ≠ 213
  const len = Math.min(a.length, b.length);
  // Hebrew tokens are already consonant skeletons, so one edit there is a bigger difference
  // than in Latin ("טדרס" Theodoros vs "סדרס" Cedrus): require 5+ letters before allowing it.
  if (/[\u0590-\u05ff]/.test(a)) return len >= 5 && editDistance(a, b, 1) <= 1;
  if (len < 4) return false;
  return editDistance(a, b, len >= 8 ? 2 : 1) <= (len >= 8 ? 2 : 1);
}
