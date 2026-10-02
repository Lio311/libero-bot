# liberoBot

השוואת מחירים יומית: כל מוצר שבמלאי ב-[libero-il.co.il](https://libero-il.co.il) מושווה מול 26 אתרי בשמים מתחרים, ומסווג ל-3 קטגוריות: **ליברו יקרים יותר / ליברו זולים יותר / מחיר זהה** (פער של עד ₪20 לכל כיוון, מול המתחרה הזול ביותר שיש לו במלאי). מייל סיכום ב-08:00 ודשבורד מוגן בקוד.

אפיון מלא: [SPEC.md](SPEC.md) · ממצאי בדיקת האתרים: [PROBE.md](PROBE.md)

## איך זה עובד

```
03:00  GitHub Actions: Nightly price scan  (scraper/run.ts, ~25 דק')
       1. ליברו: WooCommerce REST → מוצרים במלאי (בלי מיני/דוגמיות/מארזים/נלווים)
       2. 26 מתחרים במקביל: Shopify /products.json · WooCommerce Store API · Konimbo HTML
          · Super-Pharm (Hybris HTML) · Magento Idus HTML · SFCC grid · Jonathan (דפי מוצר)
       3. התאמה: ברקוד (מאומת לפי נפח+טסטר) ← אחרת שם + נפח + ריכוז
       4. Neon: offers + snapshot יומי לכל מוצר
       5. אתר שנכשל → מייל התראה מיידי (המחיר האחרון שלו נשמר עד 3 ימים, מסומן "לא עדכני")
08:00  GitHub Actions: Morning email  (scraper/digest.ts)
       סיכום כמויות · 2 הפערים הגדולים לכל כיוון · מה השתנה מאתמול
       Vercel: הדשבורד (Next.js) קורא את ה-snapshot האחרון
```

KSP ו-April לא נכללים: חוסמים גישה אוטומטית (403 / אתגר Cloudflare), והפרויקט לא משתמש בשירותי סריקה בתשלום. individualperfumes.com, laperfume.co.il, almapharm.co.il ו-perfumery.co.il לא פעילים (הדומיין לא קיים / פג). פירוט ב-[PROBE.md](PROBE.md).

## הגדרה חד-פעמית

### 1. GitHub → Settings → Secrets and variables → Actions → New repository secret

| Secret | ערך |
|---|---|
| `DATABASE_URL` | ה-connection string של Neon (pooled), **בלי מרכאות** |
| `WC_URL` | `https://libero-il.co.il` |
| `WC_CONSUMER_KEY` | המפתח מ-WooCommerce |
| `WC_CONSUMER_SECRET` | הסוד מ-WooCommerce |
| `SMTP_USER` | כתובת ה-Gmail ששולחת |
| `SMTP_PASS` | Gmail App Password (16 תווים) |
| `NOTIFY_TO` | למי נשלח המייל (אפשר כמה, מופרדים בפסיק) |
| `DASHBOARD_URL` | הכתובת של הדשבורד ב-Vercel |

### 2. Vercel → Project → Settings → Environment Variables (Production + Preview)

| משתנה | ערך |
|---|---|
| `DATABASE_URL` | אותו connection string |
| `DASHBOARD_PASSCODE` | קוד הכניסה לדשבורד |
| `AUTH_SECRET` | מחרוזת אקראית (`openssl rand -hex 32`) |

אחרי שינוי משתנים ב-Vercel צריך **Redeploy**. הדשבורד לא צריך את מפתחות WooCommerce או ה-SMTP.

### 3. הרצה ידנית

GitHub → Actions → **Nightly price scan** → Run workflow (אפשר לבחור אתרים ב-`only`).
GitHub → Actions → **Morning email** → Run workflow → `force` לשליחה מיידית.

> GitHub משבית workflows מתוזמנים אחרי 60 יום בלי commit בריפו. אם זה קורה: Actions → בחר את ה-workflow → Enable.

## פיתוח מקומי

```bash
npm install
cp .env.example .env.local   # ולמלא
npm run fetch-cache           # מוריד את כל הקטלוגים ל-data/cache (פעם אחת, ~25 דק')
npx tsx scraper/tools/match-eval.ts --sample=30   # איכות ההתאמות על הנתונים השמורים
npm run scrape -- --cache --no-email              # כל הצינור מול ה-DB, בלי לגשת לאתרים
npx tsx scraper/digest.ts --force --dry            # תצוגה מקדימה של המייל → /dev/email
npx next dev -p 3100
```

דגלים של `npm run scrape`: `--only=mist,odem` · `--dry` (בלי DB) · `--no-email` · `--cache`.

## להוסיף אתר מתחרה

אם האתר על Shopify / WooCommerce / Konimbo, זו שורה אחת ב-[scraper/sources/index.ts](scraper/sources/index.ts) ועוד אחת ב-`SOURCES` ב-[src/lib/config.ts](src/lib/config.ts). פלטפורמה אחרת = קובץ חדש ב-`scraper/sources/` שמחזיר `CompetitorItem[]`.
