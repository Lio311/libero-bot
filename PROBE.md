# Probe — ממצאי בדיקת אתרים (2026-10-02)

| אתר | פלטפורמה | שיטה | היקף קטלוג | ברקוד | מלאי | חסימה |
|---|---|---|---|---|---|---|
| libero-il.co.il | WooCommerce | REST v3 (מפתחות) | 1,331 במלאי | SKU = EAN | ✓ | — |
| mist.co.il | Shopify | `/products.json?limit=250&page=N` | ~14,500 (כולל קוסמטיקה) | sku = ברקוד | `variant.available` | אין |
| molecule-perfume.co.il | Shopify | `/products.json` | 1,424 (וריאנטים לפי ml) | לא | `variant.available` | אין |
| lolaray.co.il | WooCommerce | Store API `/wp-json/wc/store/v1/products` | 4,410 | SKU לרוב EAN | `is_in_stock` | אין |
| perfumecenter.co.il | WooCommerce | Store API | 8,594 | SKU לרוב EAN | `is_in_stock` | אין |
| kolboyehuda.co.il | WooCommerce | Store API | 9,744 (כולל איפור) | SKU לרוב EAN | `is_in_stock` | אין |
| odemc.co.il | Konimbo | HTML דפי קטגוריה, 30/עמוד, `?page=N`, דורש Referer | ~197 עמודים בבשמים (במלאי קודם) | `data-item-code` | `stock_state` | Cloudflare קל, עבר |
| novo-pharm.co.il | Konimbo | כמו odem (קטגוריות נשים/גברים/בוטיק) | קטן | חלקי | `stock_state` | אין |
| ksp.co.il | מותאם | ❌ curl 403; בדפדפן אמיתי הדף עולה אבל ה-API של המוצרים מחזיר 403 | — | — | — | **חסום לאוטומציה** |

## הערות
- כל המחירים נקראים כמחיר נוכחי (כולל מבצע). WooCommerce Store API מחזיר באגורות (`currency_minor_unit: 2`).
- שמות אצל מתחרים בפורמטים שונים (עברית בלבד ב-Mist: "טסטר - ג'וי אינטנס אדפ לאישה 90 מ"ל - כריסטיאן דיור"; דו-לשוני בליברו) → ברקוד = התאמה ראשונה מהירה, ואז שם+ml+ריכוז.
- הבדיקות רצו מ-IP ביתי. GitHub Actions רץ מ-IP של דאטה-סנטר — ייבדק בהרצה הראשונה ב-CI (בעיקר odem עם Cloudflare).
- אין Actor מוכן ל-KSP ב-Apify.

# Probe 2 — 24 אתרים נוספים (2026-10-02)

| אתר | מפתח | פלטפורמה | שיטה | הערות |
|---|---|---|---|---|
| shop.super-pharm.co.il | superpharm | SAP Hybris | HTML קטגוריית בשמים `/cosmetics/perfumes/c/20110000?page=N` (מ-0, 30 לעמוד, ~2MB לעמוד) | `data-ean`, נפח בכרטיס, `data-oos`, מחיר מבצע `data-discountPrice`. ה-API של Constructor.io לא מחזיר נפח |
| myperfume.co.il | myperfume | Konimbo | כמו odem | אין נפח בשם → נפח = מחיר ÷ מחיר ל-100 מ"ל × 100 (רק כשיוצא מספר שלם) |
| callperfume.co.il | callperfume | WooCommerce | Store API + וריאציות | ~10.5K מוצרים (כולל קוסמטיקה) |
| perfumex.co.il | perfumex | Konimbo | כמו odem | |
| beautyshopmotagim.co.il | motagim | WooCommerce | Store API | |
| perfumeclub.co.il | perfumeclub | WooCommerce | Store API + וריאציות | כל המוצרים variable (נפח/ריכוז כווריאציה) |
| blendo.co.il | blendo | WooCommerce | Store API | חנות דיופים ("בהשראת"). נפח וריכוז במאפייני המוצר; החלק שאחרי "בהשראת" לא משמש להתאמה |
| oligarch.co.il | oligarch | Shopify | `/products.json` | שמות בעברית בלבד, דיקנטים 2/5/10 מ"ל |
| jonathan.co.il | jonathan | Magento 1 | דפי קטגוריה + דף מוצר לכל פריט (3 במקביל) | בכרטיס רק שם הבושם; נפח מ-select בדף המוצר, ברקוד ומלאי מ-JSON-LD |
| lovenmour.co.il | lovenmour | Shopify | `/products.json` | ~8.5K מוצרים, כולל דיקנטים |
| perfumeil.co.il | perfumeil | Konimbo | כמו odem | |
| lilit.co.il | lilit | Magento 2 (Idus) | HTML `?p=N&product_list_limit=36` | GraphQL חסום ב-Cloudflare, דפי הקטגוריה פתוחים. ברקוד בשם קובץ התמונה |
| chozen.co.il | chozen | Shopify | קולקציה `perfumes` בלבד | חנות אופנה |
| maryshop.co.il | maryshop | WooCommerce | Store API | |
| beyondskin.co.il | beyondskin | Magento 2 (Idus) | כמו lilit | |
| glam42.co.il | glam42 | Shopify | `/products.json` | כולל קוסמטיקה |
| mashbir.co.il → 365mashbir.co.il | mashbir | Shopify | קולקציות `byshvm-klly` + `top-perfumes-for-men-1` | חנות כלבו (15K+ מוצרים); לפעמים נפח הפוך: `מ"ל 100` |
| onlys.co.il | onlys | Salesforce Commerce Cloud | `Search-UpdateGrid?cgid=PERFUME&start=N&sz=100` | ברקוד בנתיב התמונה |
| cosmetic-club.co.il | cosmeticclub | WooCommerce | Store API + וריאציות | ~12.8K מוצרים |
| april.co.il | — | Magento + Cloudflare | ❌ | 403 "Just a moment" גם בדף הבית → **חסום לאוטומציה** |
| individualperfumes.com | — | — | ❌ | הדומיין לא קיים (DNS) |
| laperfume.co.il | — | — | ❌ | הדומיין לא קיים (DNS) |
| almapharm.co.il | — | — | ❌ | הדומיין לא קיים (DNS) |
| perfumery.co.il | — | — | ❌ | דומיין שפג ("Expired DNS Hosting") |

- WooCommerce: מוצר variable מוחלף בווריאציות שלו (`?type=variation`), כי המחיר של האב הוא רק הזול מביניהן. חל גם על lolaray / perfumecenter / kolboyehuda.
- הרצה ראשונה ב-GitHub Actions (2026-10-02): 22 אתרים עברו. **סופר-פארם** (עמוד בלי מוצרים), **Blendo**, **Mary Shop** ו**לילית** (HTTP 403) חוסמים את כתובות ה-IP של GitHub, ולכן הם מושהים (`paused: true`). ביונד סקין, על אותה פלטפורמה כמו לילית, עבר.
