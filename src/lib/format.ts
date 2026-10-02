export const ils = (n: number | null | undefined) => (n == null ? "—" : `₪${n.toLocaleString("en-US")}`);

/** "+₪120" / "−₪45" */
export const signedIls = (n: number | null | undefined) =>
  n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}₪${Math.abs(n).toLocaleString("en-US")}`;

export const pct = (x: number | null | undefined) => (x == null ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.round(Math.abs(x) * 100)}%`);

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "לפני שעה" : `לפני ${h} שעות`;
  const d = Math.floor(h / 24);
  if (d < 30) return d === 1 ? "אתמול" : `לפני ${d} ימים`;
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" });
}

export const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" });

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

export const CONC_LABEL: Record<string, string> = {
  extrait: "Extrait",
  parfum: "Parfum",
  edp: "EDP",
  edt: "EDT",
  edc: "Cologne",
};
