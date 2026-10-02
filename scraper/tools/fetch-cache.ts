// Downloads Libero + every competitor catalog into data/cache/*.json (for developing the matcher
// offline). Usage: npm run fetch-cache [-- --only=mist,odem]
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

import { mkdirSync, writeFileSync } from "node:fs";
import { fetchLiberoProducts } from "../lib/libero";
import { ALL_SOURCES } from "../sources";

const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1]?.split(",");
const log = (...m: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...m);

mkdirSync("data/cache", { recursive: true });

async function main() {
  const jobs: Promise<void>[] = [];
  if (!only || only.includes("libero"))
    jobs.push(
      fetchLiberoProducts().then(({ products, excluded }) => {
        writeFileSync("data/cache/libero.json", JSON.stringify(products, null, 1));
        log(`libero: ${products.length} products (${excluded} excluded)`);
      }),
    );
  for (const s of ALL_SOURCES.filter((s) => !only || only.includes(s.key))) {
    const t = Date.now();
    jobs.push(
      s
        .run()
        .then((r) => {
          writeFileSync(`data/cache/${s.key}.json`, JSON.stringify(r.items, null, 1));
          log(`${s.key}: ${r.items.length} items, ${r.items.filter((i) => i.inStock).length} in stock, ${Math.round((Date.now() - t) / 1000)}s`, r.warnings.join("; "));
        })
        .catch((e) => log(`${s.key}: FAILED ${(e as Error).name} ${(e as Error).message}`)),
    );
  }
  await Promise.all(jobs);
}

main();
