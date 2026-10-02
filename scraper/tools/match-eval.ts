// Runs the matcher on data/cache/*.json and prints coverage plus samples to eyeball.
// Usage: npx tsx scraper/tools/match-eval.ts [--sample=30] [--source=mist] [--grep=sauvage]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SOURCE_KEYS, verdictFor } from "../../src/lib/config";
import type { LiberoProduct } from "../lib/libero";
import { matchAll } from "../lib/match";
import { parseTitle } from "../lib/perfume";
import type { CompetitorItem } from "../types";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const sample = Number(arg("sample") ?? 25);
const onlySource = arg("source");
const grep = arg("grep")?.toLowerCase();

const products: LiberoProduct[] = JSON.parse(readFileSync("data/cache/libero.json", "utf8"));
const items: CompetitorItem[] = SOURCE_KEYS.filter((k) => existsSync(`data/cache/${k}.json`)).flatMap((k) =>
  JSON.parse(readFileSync(`data/cache/${k}.json`, "utf8")),
);

const parsedLibero = products.map((p) => ({ p, t: parseTitle(p.name) }));
console.log(`libero ${products.length}: no ml ${parsedLibero.filter((x) => x.t.ml == null).length}, no conc ${parsedLibero.filter((x) => !x.t.conc).length}, testers ${parsedLibero.filter((x) => x.t.tester).length}, excluded ${parsedLibero.filter((x) => x.t.excluded).length}`);

const t0 = Date.now();
const { matches, stats } = matchAll(products, items);
console.log(`matched in ${Date.now() - t0}ms; usable competitor items`, stats.competitorUsable, "libero skipped", stats.liberoSkipped);

const byProduct = new Map<number, typeof matches>();
for (const m of matches) (byProduct.get(m.productId) ?? byProduct.set(m.productId, []).get(m.productId)!).push(m);
console.log(`products with ≥1 match: ${byProduct.size}/${products.length}`);
for (const k of SOURCE_KEYS) {
  const ms = matches.filter((m) => m.item.source === k);
  console.log(`  ${k.padEnd(14)} ${String(ms.length).padStart(4)} (barcode ${ms.filter((m) => m.method === "barcode").length}, name ${ms.filter((m) => m.method === "name").length}, conc assumed ${ms.filter((m) => m.concAssumed).length})`);
}

const verdicts = { pricier: 0, cheaper: 0, same: 0, unmatched: 0 };
for (const p of products) {
  const offers = (byProduct.get(p.id) ?? []).filter((m) => m.item.inStock);
  const min = offers.length ? Math.min(...offers.map((m) => m.item.price)) : null;
  verdicts[verdictFor(min == null ? null : p.price - min)]++;
}
console.log("verdicts", verdicts);

const pool = matches.filter(
  (m) => (!onlySource || m.item.source === onlySource) && (!grep || (products.find((p) => p.id === m.productId)!.name + m.item.title).toLowerCase().includes(grep)),
);
const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, sample);
for (const m of shuffled) {
  const p = products.find((x) => x.id === m.productId)!;
  console.log(`\n[${m.item.source} ${m.method}${m.concAssumed ? " conc?" : ""} ${m.score.toFixed(2)}] ₪${p.price} vs ₪${m.item.price}${m.item.inStock ? "" : " (OOS)"}\n  L: ${p.name}\n  C: ${m.item.title}`);
}
writeFileSync("data/matches.json", JSON.stringify(matches.map((m) => ({ ...m, libero: products.find((p) => p.id === m.productId)!.name })), null, 1));
