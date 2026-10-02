import { BlockedError } from "../types";

// One realistic desktop Chrome per run, polite pacing, no evasion beyond that.
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Random pause in [min, max] ms. */
export const jitter = (min: number, max: number) => sleep(min + Math.random() * (max - min));

const CHALLENGE = /cf-chl|Just a moment|captcha-delivery|perfdrive|רק רגע|Access Denied/i;

interface GetOptions {
  headers?: Record<string, string>;
  /** Attempts for timeouts and 5xx (403/429 never retry: retrying deepens a block). */
  retries?: number;
  timeoutMs?: number;
}

export async function get(url: string, opts: GetOptions = {}): Promise<Response> {
  const { retries = 2, timeoutMs = 45_000 } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
          ...opts.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 403 || res.status === 429) throw new BlockedError(`HTTP ${res.status} ${new URL(url).pathname}`);
      if (res.status >= 500) throw new Error(`HTTP ${res.status} ${new URL(url).pathname}`);
      return res;
    } catch (e) {
      if (e instanceof BlockedError) throw e;
      lastError = e;
      if (attempt < retries) await sleep(3000 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function getJson<T>(url: string, opts?: GetOptions): Promise<{ data: T; res: Response }> {
  const res = await get(url, { ...opts, headers: { Accept: "application/json", ...opts?.headers } });
  const text = await res.text();
  if (CHALLENGE.test(text.slice(0, 5000)) && !text.trimStart().startsWith("{") && !text.trimStart().startsWith("["))
    throw new BlockedError(`challenge page at ${new URL(url).pathname}`);
  try {
    return { data: JSON.parse(text) as T, res };
  } catch {
    throw new Error(`not JSON (${res.status}) at ${new URL(url).pathname}: ${text.slice(0, 80)}`);
  }
}

export async function getHtml(url: string, opts?: GetOptions): Promise<string> {
  const res = await get(url, opts);
  const html = await res.text();
  if (CHALLENGE.test(html.slice(0, 20000)) && html.length < 50_000) throw new BlockedError(`challenge page at ${new URL(url).pathname}`);
  return html;
}

/** Decodes the HTML entities WordPress leaves in product names (&#8211; &quot; &amp; ...). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** "1,090 ₪" → 1090. Returns null when no number is present. */
export function parseShekels(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/[^\d.,]/g, " ").match(/\d[\d,]*(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Keeps a code only when it looks like an EAN/UPC (8–14 digits). */
export function barcodeOf(s: string | null | undefined): string | null {
  const v = (s ?? "").trim();
  return /^\d{8,14}$/.test(v) ? v.replace(/^0+/, "") : null;
}
