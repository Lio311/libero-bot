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
