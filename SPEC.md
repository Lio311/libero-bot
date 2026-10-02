# libero-bot — אפיון

בוט השוואת מחירים יומי: לוקח את המוצרים שבמלאי ב-libero-il.co.il (WooCommerce API), מחפש **רק אותם** אצל המתחרים, ומסווג כל מוצר ל-3 קטגוריות. מבוסס על הסקיל `listings-aggregator-bot` (diraBot).

## מקור הנתונים — ליברו
- WooCommerce REST v3: `GET /wp-json/wc/v3/products?status=publish&stock_status=instock` (≈1,331 מוצרים, 100 לעמוד).
- נכלל: **בקבוקים רגילים + טסטרים**. לא נכלל: מיני, דוגמיות, חבילות, מוצרים נלווים.
- מותגי הבית (פיצרילי, לה בורה, תיאודורוס…) — **נבדקים** (גילוי יבוא מקביל).
- מחיר להשוואה: `price` (המחיר הנוכחי כולל מבצע), ללא משלוח/קופונים.

## מתחרים
molecule-perfume.co.il · lolaray.co.il · perfumecenter.co.il · novo-pharm.co.il · mist.co.il · odemc.co.il · **kolboyehuda.co.il** (נוסף מהמחקר)

נוספו (2026-10-02): shop.super-pharm.co.il · myperfume.co.il · callperfume.co.il · perfumex.co.il · beautyshopmotagim.co.il · perfumeclub.co.il · blendo.co.il · oligarch.co.il · jonathan.co.il · lovenmour.co.il · perfumeil.co.il · lilit.co.il · chozen.co.il · maryshop.co.il · beyondskin.co.il · glam42.co.il · 365mashbir.co.il · onlys.co.il · cosmetic-club.co.il

לא נוספו: april.co.il (Cloudflare חוסם), individualperfumes.com · laperfume.co.il · almapharm.co.il (הדומיין לא קיים), perfumery.co.il (דומיין שפג)

**KSP הוסר**: חוסם גישה אוטומטית (ראה PROBE.md), ולא נמצא ב-Zap. העדפה קבועה: בלי Apify / שירותי סריקה בתשלום.

## התאמת מוצרים
- התאמה = **שם (מותג + שם בושם) + נפח ml + ריכוז** (EDP / EDT / Extrait / Parfum / Cologne / Elixir…).
- ברקוד = סיגנל עזר בלבד (לעיתים שונה בין אתרים), לא תנאי.
- טסטר מושווה **רק לטסטר**; רגיל רק לרגיל.
- מוצר שאזל אצל מתחרה — **לא נספר** בסיווג, מוצג באפור "אזל ב-X".
- כלי בדשבורד: **"הסתר מוצר" / "התאמה שגויה"** — נשמר ב-DB ונכבד בסריקות הבאות.
- אתר שלא מציין ריכוז (בעיקר Molecule): מותאם לפי שם + נפח רק כשאין שם יותר מגרסה אחת, ומסומן "האתר לא ציין ריכוז".

## סיווג (מול המתחרה הזול ביותר שיש לו במלאי)
| קטגוריה | תנאי (פער = מחיר ליברו − מחיר מתחרה זול) |
|---|---|
| ליברו יקרים יותר | פער > ₪20 |
| מחיר זהה | ‎−₪20 ≤ פער ≤ ₪20 |
| ליברו זולים יותר | פער < −₪20 |
| לא נמצא אצל מתחרים | אין התאמה במלאי (מוצג בנפרד, לא במייל) |

"הפער הגדול ביותר" נמדד ב-**₪** (גם % מוצג וניתן למיון).

## היסטוריה
- נשמר מחיר יומי לכל מוצר×מתחרה → **גרף מחיר** לכל מוצר.
- "מה השתנה מאתמול": מוצרים שעברו קטגוריה / מתחרה ששינה מחיר.

## מייל יומי — 08:00 לשעון ישראל, לכתובת ב-NOTIFY_TO
- כמה מוצרים: יקרים יותר / זולים יותר / זהים.
- 2 דוגמאות עם הפער הגדול ביותר בכל כיוון (מוצר, מחיר ליברו, מחיר מתחרה + שם האתר, פער ₪).
- מה השתנה מאתמול (תקציר).
- קישור לדשבורד.
- **התראה נפרדת ומיידית** אם אתר נחסם/נכשל בסריקה (מוצרי האתר מחושבים לפי המחיר האחרון התקין, מסומנים "לא עדכני").

## דשבורד (Next.js על Vercel, מוגן בקוד גישה)
- 3 טאבים לפי הקטגוריות + "לא נמצא אצל מתחרים".
- כל שורה: מוצר, מחיר ליברו, כל מחירי המתחרים זה לצד זה (הזול מודגש), פער ₪ ו-%, קישורים לדפי המוצר.
- **סינון:** מותג · קטגוריית ליברו (גבר/אישה/יוניסקס/נישה/יוקרה/דובאי) · מתחרה ספציפי · טווח מחיר · טווח פער ₪/% · טסטר/רגיל · ריכוז · נפח · מלאי אצלי (כמות) · מבצע פעיל אצלי · "השתנה מאתמול" · חיפוש חופשי.
- **מיון:** פער ₪ (ברירת מחדל) · פער % · מחיר · מס' מתחרים שמחזיקים · מלאי אצלי · שם.
- גרף היסטוריית מחיר בפתיחת מוצר.

## תזמון ותשתית
- **GitHub Actions** (לא Vercel Cron):
  - `scrape.yml` — סריקה פעם ביום בלילה (~04:00–05:00 שעון ישראל), שומר ל-Neon, שולח התראת כשל אם צריך.
  - `digest.yml` — שני cron-ים ב-UTC (04:47, 05:47) עם בדיקה בקוד שהשעה בישראל 07:45 ומעלה ושלא נשלח היום → מתמודד עם שעון קיץ/חורף. (GitHub לפעמים מאחר בכמה דקות.)
- הריפו **ציבורי** → אין סודות/אימייל בקוד או ב-`.env.example`. הכל ב-Secrets/env.

## GitHub Actions — Secrets
(Settings → Secrets and variables → Actions → New repository secret)
| Secret | מה זה |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (בלי מרכאות) |
| `WC_URL` | `https://libero-il.co.il` |
| `WC_CONSUMER_KEY` | המפתח מ-WooCommerce |
| `WC_CONSUMER_SECRET` | הסוד מ-WooCommerce |
| `SMTP_USER` | כתובת ה-Gmail ששולחת |
| `SMTP_PASS` | Gmail App Password (16 תווים) |
| `NOTIFY_TO` | הכתובת שמקבלת את המייל |
| `DASHBOARD_URL` | כתובת הדשבורד ב-Vercel (לקישורים במייל) |

## Vercel — Environment Variables
(Project → Settings → Environment Variables, ל-Production + Preview)
| משתנה | מה זה |
|---|---|
| `DATABASE_URL` | אותו Neon connection string |
| `DASHBOARD_PASSCODE` | קוד הכניסה לדשבורד |
| `AUTH_SECRET` | מחרוזת אקראית לחתימת עוגיית הכניסה (`openssl rand -hex 32`) |

הדשבורד לא צריך את מפתחות WooCommerce ולא את ה-SMTP — הם רק ב-GitHub Actions.

## שלבים
1. ✅ ראיון ואפיון
2. ✅ Probe לכל האתרים → PROBE.md
3. ✅ סורקים, מנוע התאמה, schema
4. ✅ הרצה מול Neon (מנתונים שמורים)
5. ✅ מייל + workflows
6. ✅ דשבורד
7. ⏳ Push לגיטהאב, Secrets, Vercel, הרצה ראשונה מלאה ב-CI
