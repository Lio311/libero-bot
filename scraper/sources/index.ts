import { SOURCES } from "../../src/lib/config";
import type { Source } from "../types";
import { konimboSource } from "./konimbo";
import { shopifySource } from "./shopify";
import { wooSource } from "./woo";

// KSP is not here: it blocks automated access to its product API (403 even from a real
// browser), and the project avoids paid scraping services. See PROBE.md.

export const ALL_SOURCES: Source[] = [
  shopifySource("mist", SOURCES.mist.url),
  shopifySource("molecule", SOURCES.molecule.url),
  wooSource("lolaray", SOURCES.lolaray.url),
  wooSource("perfumecenter", SOURCES.perfumecenter.url),
  wooSource("kolboyehuda", SOURCES.kolboyehuda.url),
  // Odem: the main perfume category already holds testers and boutique lines; the extra
  // categories catch anything filed only there (deduped by item id).
  konimboSource("odem", SOURCES.odem.url, [
    "160098-%D7%91%D7%A9%D7%9E%D7%99%D7%9D", // בשמים
    "160157-%D7%91%D7%A9%D7%9E%D7%99-%D7%91%D7%95%D7%98%D7%99%D7%A7", // בשמי בוטיק
  ]),
  konimboSource("novopharm", SOURCES.novopharm.url, [
    "286269-%D7%A0%D7%A9%D7%99%D7%9D", // נשים
    "358507-%D7%92%D7%91%D7%A8%D7%99%D7%9D-", // גברים
    "286270-%D7%91%D7%A9%D7%9E%D7%99-%D7%91%D7%95%D7%98%D7%99%D7%A7", // בשמי בוטיק
  ], "icon"),
];
