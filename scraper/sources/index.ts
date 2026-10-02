import { SOURCE_KEYS, SOURCES } from "../../src/lib/config";
import type { Source } from "../types";
import { idusSource } from "./idus";
import { jonathanSource } from "./jonathan";
import { konimboSource } from "./konimbo";
import { sfccSource } from "./sfcc";
import { shopifySource } from "./shopify";
import { superPharmSource } from "./superpharm";
import { wooSource } from "./woo";

// Not here (see PROBE.md): KSP and April block automated access (403 / Cloudflare challenge
// even on the home page), and the project avoids paid scraping services. individualperfumes.com,
// laperfume.co.il and almapharm.co.il don't resolve; perfumery.co.il is an expired domain.

const SCRAPERS: Source[] = [
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
  wooSource("callperfume", SOURCES.callperfume.url),
  wooSource("motagim", SOURCES.motagim.url),
  wooSource("perfumeclub", SOURCES.perfumeclub.url),
  wooSource("blendo", SOURCES.blendo.url),
  wooSource("maryshop", SOURCES.maryshop.url),
  wooSource("cosmeticclub", SOURCES.cosmeticclub.url),
  shopifySource("oligarch", SOURCES.oligarch.url),
  shopifySource("lovenmour", SOURCES.lovenmour.url),
  shopifySource("glam42", SOURCES.glam42.url),
  // Fashion / department stores: only their perfume collections.
  shopifySource("chozen", SOURCES.chozen.url, ["perfumes"]),
  shopifySource("mashbir", SOURCES.mashbir.url, ["byshvm-klly", "top-perfumes-for-men-1"]),
  konimboSource("myperfume", SOURCES.myperfume.url, [
    "155570-%D7%91%D7%A9%D7%9E%D7%99%D7%9D-%D7%9C%D7%90%D7%99%D7%A9%D7%94", // בשמים לאישה
    "155568-%D7%91%D7%A9%D7%9E%D7%99%D7%9D-%D7%9C%D7%92%D7%91%D7%A8", // בשמים לגבר
    "155572-%D7%91%D7%A9%D7%9E%D7%99%D7%9D-%D7%99%D7%95%D7%A0%D7%99%D7%A1%D7%A7%D7%A1", // בשמים יוניסקס
    "155574-%D7%91%D7%A9%D7%9E%D7%99-%D7%91%D7%95%D7%98%D7%99%D7%A7", // בשמי בוטיק
    "190937-%D7%98%D7%A1%D7%98%D7%A8%D7%99%D7%9D-", // טסטרים
  ]),
  konimboSource("perfumex", SOURCES.perfumex.url, [
    "221590-%D7%91%D7%A9%D7%9E%D7%99%D7%9D-%D7%9C%D7%A0%D7%A9%D7%99%D7%9D", // בשמים לנשים
    "221591-%D7%91%D7%A9%D7%9E%D7%99%D7%9D-%D7%9C%D7%90%D7%99%D7%A9%D7%94", // בשמים לאישה
    "223935-%D7%91%D7%A9%D7%9E%D7%99%D7%9D-%D7%9C%D7%92%D7%91%D7%A8", // בשמים לגבר
    "227024-%D7%91%D7%A9%D7%9E%D7%99%D7%9D-%D7%9C%D7%92%D7%91%D7%A8%D7%99%D7%9D", // בשמים לגברים
    "221600-%D7%91%D7%A9%D7%9E%D7%99-%D7%91%D7%95%D7%98%D7%99%D7%A7", // בשמי בוטיק
    "223931-%D7%98%D7%A1%D7%98%D7%A8%D7%99%D7%9D-%D7%9C%D7%90%D7%99%D7%A9%D7%94", // טסטרים לאישה
    "223941-%D7%98%D7%A1%D7%98%D7%A8%D7%99%D7%9D-%D7%9C%D7%92%D7%91%D7%A8", // טסטרים לגבר
  ]),
  konimboSource("perfumeil", SOURCES.perfumeil.url, [
    "198320-%D7%91%D7%A9%D7%9E%D7%99%D7%9D-%D7%9C%D7%90%D7%99%D7%A9%D7%94", // בשמים לאישה
    "198317-%D7%91%D7%A9%D7%9E%D7%99%D7%9D-%D7%9C%D7%92%D7%91%D7%A8", // בשמים לגבר
    "198456-%D7%91%D7%A9%D7%9E%D7%99-%D7%91%D7%95%D7%98%D7%99%D7%A7", // בשמי בוטיק
    "198329-%D7%90%D7%A8%D7%99%D7%96%D7%95%D7%AA-%D7%98%D7%A1%D7%98%D7%A8", // אריזות טסטר
  ]),
  superPharmSource(),
  idusSource("lilit", SOURCES.lilit.url, "perfume"),
  idusSource("beyondskin", SOURCES.beyondskin.url, "perfume"),
  sfccSource("onlys", SOURCES.onlys.url, "onlys", "PERFUME"),
  jonathanSource(),
];

/** Every scraper except the sites paused in SOURCES (see SOURCE_KEYS). */
export const ALL_SOURCES = SCRAPERS.filter((s) => SOURCE_KEYS.includes(s.key));
