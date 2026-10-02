import type { getDb } from "../../src/db/client";
import { emailLog } from "../../src/db/schema";
import { SAME_PRICE_BAND, SOURCES, type SourceKey } from "../../src/lib/config";
import { getMailer } from "../../src/lib/mailer";

type Db = ReturnType<typeof getDb>;

const ils = (n: number | null | undefined) => (n == null ? "—" : `₪${n.toLocaleString("en-US")}`);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const siteName = (s: string | null) => (s ? (SOURCES[s as SourceKey]?.name ?? s) : "—");

const C = {
  bg: "#f7f6f3",
  card: "#ffffff",
  border: "#ecebe8",
  fg: "#1c1b19",
  muted: "#6f6b64",
  faint: "#a19c93",
  accent: "#9a3412",
  pricier: { fg: "#b42318", bg: "#fdeceb" },
  cheaper: { fg: "#0b6b3a", bg: "#e8f5ee" },
  same: { fg: "#57534e", bg: "#f1f1ef" },
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Heebo,Arial,sans-serif";

function shell(inner: string) {
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:${C.bg};font-family:${FONT}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl"><tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.card};border-radius:16px;border:1px solid ${C.border}" dir="rtl">
      ${inner}
    </table>
  </td></tr></table></body></html>`;
}

const wordmark = `<div style="font-size:15px;font-weight:700;color:${C.fg};letter-spacing:-.01em;direction:ltr;text-align:right">libero<span style="color:${C.accent}">Bot</span></div>`;

export interface DigestExample {
  name: string;
  url: string;
  liberoPrice: number;
  minPrice: number;
  minSource: string;
  minUrl: string | null;
  gap: number;
}

export interface DigestChange {
  name: string;
  from: string;
  to: string;
  detail: string;
}

export interface DigestData {
  day: string;
  /** The snapshot is from an earlier day (today's scan didn't finish). */
  staleDay: boolean;
  counts: { pricier: number; cheaper: number; same: number; unmatched: number };
  prevCounts: { pricier: number; cheaper: number; same: number } | null;
  topPricier: DigestExample[];
  topCheaper: DigestExample[];
  changes: DigestChange[];
  changesTotal: number;
  sourceStatus: { name: string; ok: boolean; note?: string }[];
  dashboardUrl: string | null;
}

function delta(now: number, prev: number | undefined) {
  if (prev == null || now === prev) return "";
  const d = now - prev;
  return `<div style="font-size:11px;color:${C.faint};margin-top:2px">${d > 0 ? "+" : "−"}${Math.abs(d)} מאתמול</div>`;
}

function tile(label: string, n: number, tone: { fg: string; bg: string }, prev?: number) {
  return `<td width="33%" style="padding:4px">
    <div style="background:${tone.bg};border-radius:12px;padding:14px 12px;text-align:center">
      <div style="font-size:28px;font-weight:700;color:${tone.fg};font-variant-numeric:tabular-nums;line-height:1.1">${n}</div>
      <div style="font-size:12px;color:${tone.fg};margin-top:4px;font-weight:600">${label}</div>
      ${delta(n, prev)}
    </div></td>`;
}

function exampleRow(e: DigestExample, tone: { fg: string; bg: string }) {
  const pct = Math.round((Math.abs(e.gap) / e.minPrice) * 100);
  return `<tr><td style="padding:12px 0;border-bottom:1px solid ${C.border}">
    <a href="${esc(e.url)}" style="font-size:14px;font-weight:600;color:${C.fg};text-decoration:none;line-height:1.4" dir="auto">${esc(e.name)}</a>
    <div style="font-size:13px;color:${C.muted};margin-top:6px;font-variant-numeric:tabular-nums">
      ליברו <b style="color:${C.fg}">${ils(e.liberoPrice)}</b>
      &nbsp;·&nbsp; ${e.minUrl ? `<a href="${esc(e.minUrl)}" style="color:${C.muted}">${esc(siteName(e.minSource))}</a>` : esc(siteName(e.minSource))} <b style="color:${C.fg}">${ils(e.minPrice)}</b>
      &nbsp;<span dir="ltr" style="display:inline-block;padding:2px 8px;border-radius:999px;background:${tone.bg};color:${tone.fg};font-weight:700;font-size:12px;unicode-bidi:isolate">${e.gap > 0 ? "+" : "−"}${ils(Math.abs(e.gap))} (${pct}%)</span>
    </div>
  </td></tr>`;
}

function section(title: string, body: string) {
  return `<div style="font-size:12px;font-weight:700;color:${C.faint};letter-spacing:.04em;margin:26px 0 4px">${title}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl">${body}</table>`;
}

export function renderDigest(d: DigestData) {
  const dateHe = new Date(`${d.day}T12:00:00Z`).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" });
  const failed = d.sourceStatus.filter((s) => !s.ok);
  const html = shell(`
      <tr><td style="padding:26px 26px 6px">
        ${wordmark}
        <div style="font-size:22px;font-weight:700;color:${C.fg};margin-top:16px;letter-spacing:-.02em">סיכום מחירים · ${esc(dateHe)}</div>
        <div style="font-size:13px;color:${C.muted};margin-top:4px">${d.counts.pricier + d.counts.cheaper + d.counts.same} מוצרים נמצאו אצל מתחרים · מחיר זהה = פער של עד ₪${SAME_PRICE_BAND}${d.staleDay ? ` · <b style="color:${C.pricier.fg}">הסריקה של היום לא הסתיימה, אלה נתוני ${esc(d.day)}</b>` : ""}</div>
      </td></tr>
      <tr><td style="padding:14px 22px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl"><tr>
          ${tile("ליברו יקרים יותר", d.counts.pricier, C.pricier, d.prevCounts?.pricier)}
          ${tile("ליברו זולים יותר", d.counts.cheaper, C.cheaper, d.prevCounts?.cheaper)}
          ${tile("מחיר זהה", d.counts.same, C.same, d.prevCounts?.same)}
        </tr></table>
        <div style="font-size:12px;color:${C.faint};margin-top:8px;text-align:center">${d.counts.unmatched} מוצרים לא נמצאו אצל אף מתחרה</div>
      </td></tr>
      <tr><td style="padding:0 26px">
        ${d.topPricier.length ? section("הפערים הגדולים · ליברו יקרים יותר", d.topPricier.map((e) => exampleRow(e, C.pricier)).join("")) : ""}
        ${d.topCheaper.length ? section("הפערים הגדולים · ליברו זולים יותר", d.topCheaper.map((e) => exampleRow(e, C.cheaper)).join("")) : ""}
        ${
          d.changes.length
            ? section(
                `מה השתנה מאתמול (${d.changesTotal})`,
                d.changes
                  .map(
                    (c) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.border};font-size:13px;color:${C.muted};line-height:1.5">
                  <span dir="auto" style="color:${C.fg};font-weight:600">${esc(c.name)}</span><br>${esc(c.from)} ← ${esc(c.to)} · ${esc(c.detail)}</td></tr>`,
                  )
                  .join(""),
              )
            : ""
        }
      </td></tr>
      <tr><td style="padding:24px 26px 26px">
        ${d.dashboardUrl ? `<a href="${esc(d.dashboardUrl)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:${C.fg};color:#fff;font-size:14px;font-weight:600;text-decoration:none">לדשבורד המלא ←</a>` : ""}
        <div style="font-size:11px;color:${C.faint};margin-top:16px;line-height:1.6">אתרים: ${d.sourceStatus.map((s) => `${esc(s.name)} ${s.ok ? "✓" : "✗"}`).join(" · ")}${failed.length ? ` · אתרים שנכשלו מחושבים לפי המחיר האחרון שנקרא` : ""}</div>
      </td></tr>`);

  const subject = `ליברו · ${d.counts.pricier} יקרים · ${d.counts.cheaper} זולים · ${d.counts.same} זהים${failed.length ? " · ⚠ " + failed.map((f) => f.name).join(", ") : ""}`;
  return { subject, html };
}

async function send(subject: string, html: string) {
  const mailer = getMailer();
  if (!mailer) throw new Error("SMTP_USER / SMTP_PASS not set");
  const to = process.env.NOTIFY_TO ?? process.env.SMTP_USER!;
  const info = await mailer.transport.sendMail({ from: mailer.from, to, subject, html });
  if (mailer.mode === "log") console.log(`[mail:log] → ${to}: ${subject}\n${String((info as { message?: unknown }).message ?? "").slice(0, 300)}`);
}

export async function sendDigest(db: Db, day: string, data: DigestData) {
  const { subject, html } = renderDigest(data);
  await send(subject, html);
  await db.insert(emailLog).values({ kind: "digest", day, subject });
  return subject;
}

/** Sent right after a run in which a site was blocked or failed. */
export async function sendFailureAlert(db: Db, day: string, failures: { name: string; status: "blocked" | "error"; message: string }[]) {
  const subject = `⚠ ליברו בוט · ${failures.map((f) => f.name).join(", ")} ${failures.length === 1 ? "נכשל" : "נכשלו"} בסריקה`;
  const html = shell(`
      <tr><td style="padding:26px">
        ${wordmark}
        <div style="font-size:20px;font-weight:700;color:${C.fg};margin-top:16px">בעיה בסריקה הלילית</div>
        <div style="font-size:14px;color:${C.muted};margin-top:8px;line-height:1.6">המוצרים של ${failures.length === 1 ? "האתר הזה" : "האתרים האלה"} יחושבו לפי המחיר האחרון שנקרא (עד 3 ימים) ויסומנו כ"לא עדכני". אם זה חוזר כמה ימים ברצף, כנראה שהאתר שינה מבנה או חוסם.</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px" dir="rtl">
          ${failures
            .map(
              (f) => `<tr><td style="padding:10px 0;border-top:1px solid ${C.border};font-size:14px">
            <b>${esc(f.name)}</b> · <span style="color:${f.status === "blocked" ? "#b45309" : C.pricier.fg}">${f.status === "blocked" ? "חסום" : "שגיאה"}</span>
            <div dir="ltr" style="font-size:12px;color:${C.faint};margin-top:4px;text-align:right;font-family:ui-monospace,Menlo,monospace">${esc(f.message.slice(0, 200))}</div>
          </td></tr>`,
            )
            .join("")}
        </table>
      </td></tr>`);
  await send(subject, html);
  await db.insert(emailLog).values({ kind: "alert", day, subject });
}
