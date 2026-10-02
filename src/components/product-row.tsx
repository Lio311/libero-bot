"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memo, useEffect, useState } from "react";
import { loadHistory } from "@/lib/actions";
import type { Verdict } from "@/lib/config";
import type { HistoryPoint, OfferView, ProductView } from "@/lib/data";
import { CONC_LABEL, ils, pct, signedIls } from "@/lib/format";
import { HistoryChart } from "./history-chart";
import { EASE, siteColor, siteName } from "./ui";

export interface Evaluated {
  p: ProductView;
  verdict: Verdict;
  gap: number | null;
  gapPct: number | null;
  /** The competitor offer the verdict is measured against. */
  ref: OfferView | null;
  live: OfferView[];
  changed: boolean;
}

export const VERDICT_TONE: Record<Verdict, { fg: string; bg: string }> = {
  pricier: { fg: "var(--pricier)", bg: "var(--pricier-soft)" },
  cheaper: { fg: "var(--cheaper)", bg: "var(--cheaper-soft)" },
  same: { fg: "var(--same)", bg: "var(--same-soft)" },
  unmatched: { fg: "var(--unmatched)", bg: "var(--unmatched-soft)" },
};

const historyCache = new Map<number, HistoryPoint[]>();

export const GRID = "lg:grid lg:grid-cols-[minmax(0,1fr)_104px_176px_128px_64px_28px] lg:items-center lg:gap-4";

export const ProductRow = memo(function ProductRow({
  e,
  open,
  onToggle,
  onReject,
  onIgnore,
}: {
  e: Evaluated;
  open: boolean;
  onToggle: (id: number) => void;
  onReject: (productId: number, offerId: number) => void;
  onIgnore: (productId: number, ignored: boolean) => void;
}) {
  const { p, verdict, gap, gapPct, ref } = e;
  const tone = VERDICT_TONE[verdict];
  const reduce = useReducedMotion();
  const detailId = `detail-${p.id}`;

  return (
    <li className={`border-b border-border last:border-b-0 ${open ? "bg-surface-2/50" : ""}`}>
      <button
        type="button"
        onClick={() => onToggle(p.id)}
        aria-expanded={open}
        aria-controls={detailId}
        className={`w-full px-4 py-3 text-start transition-colors hover:bg-surface-2/70 sm:px-5 ${GRID}`}
      >
        {/* Product */}
        <div className="flex min-w-0 items-start gap-3">
          <Thumb src={p.image} />
          <div className="min-w-0 flex-1">
            <div dir="auto" className="line-clamp-2 text-[14px] font-medium leading-snug text-fg">
              {p.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-muted">
              {[p.brand && <span className="font-medium text-fg/80">{p.brand}</span>, p.ml != null && <span>{p.ml}ml</span>, p.conc && <span>{CONC_LABEL[p.conc] ?? p.conc}</span>]
                .filter(Boolean)
                .map((node, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    {i > 0 && (
                      <span aria-hidden className="text-faint">
                        ·
                      </span>
                    )}
                    {node}
                  </span>
                ))}
              {p.tester && <Badge>טסטר</Badge>}
              {p.onSale && <Badge tone="accent">מבצע</Badge>}
              {p.stockQty != null && p.stockQty <= 2 && <Badge>מלאי {p.stockQty}</Badge>}
              {e.changed && <Badge tone="accent">השתנה מאתמול</Badge>}
              {p.ignored && <Badge>מוסתר</Badge>}
            </div>
          </div>
        </div>

        {/* Mobile: prices in one line under the name */}
        <div className="mt-2.5 flex items-center justify-between gap-3 ps-[52px] lg:hidden">
          <div className="min-w-0 flex-1 text-[13px] tabular text-muted">
            <span className="font-semibold text-fg">{ils(p.price)}</span>
            {ref && (
              <>
                {" "}
                מול <span className="font-semibold text-fg">{ils(ref.price)}</span> · {siteName(ref.source)}
              </>
            )}
          </div>
          {gap != null && <GapPill gap={gap} gapPct={gapPct} tone={tone} />}
        </div>

        {/* Desktop columns */}
        <div className="hidden text-[14px] tabular lg:block">
          <div className="font-semibold">{ils(p.price)}</div>
          {p.onSale && p.regularPrice && p.regularPrice > p.price && <div className="text-[12px] text-faint line-through">{ils(p.regularPrice)}</div>}
        </div>
        <div className="hidden min-w-0 lg:block">
          {ref ? (
            <>
              <div className="text-[14px] font-semibold tabular">{ils(ref.price)}</div>
              <div className="flex items-center gap-1.5 truncate text-[12px] text-muted">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: siteColor(ref.source) }} />
                {siteName(ref.source)}
                {ref.stale && <span className="text-faint">· לא עדכני</span>}
              </div>
            </>
          ) : (
            <span className="text-[13px] text-faint">{p.offers.length ? "אזל אצל כולם" : "—"}</span>
          )}
        </div>
        <div className="hidden lg:block">{gap != null ? <GapPill gap={gap} gapPct={gapPct} tone={tone} /> : <span className="text-faint">—</span>}</div>
        <div className="hidden text-[13px] text-muted tabular lg:block">{e.live.length ? `${e.live.length} אתרים` : "—"}</div>
        <div className="hidden justify-self-end text-faint lg:block">
          <svg viewBox="0 0 16 16" className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" aria-hidden>
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={detailId}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <Detail e={e} onReject={onReject} onIgnore={onIgnore} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
});

function Detail({ e, onReject, onIgnore }: { e: Evaluated; onReject: (productId: number, offerId: number) => void; onIgnore: (productId: number, ignored: boolean) => void }) {
  const { p } = e;
  const [history, setHistory] = useState<HistoryPoint[] | null>(historyCache.get(p.id) ?? null);
  useEffect(() => {
    if (historyCache.has(p.id)) return;
    let live = true;
    loadHistory(p.id).then((h) => {
      historyCache.set(p.id, h);
      if (live) setHistory(h);
    });
    return () => {
      live = false;
    };
  }, [p.id]);

  return (
    <div className="grid gap-6 px-4 pb-5 pt-1 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:ps-[68px]">
      <section aria-label="מחירים אצל מתחרים">
        <h3 className="mb-2 text-[12px] font-semibold tracking-[0.04em] text-faint">אצל המתחרים</h3>
        {p.offers.length === 0 ? (
          <p className="text-[13px] text-muted">לא נמצאה התאמה באף אתר (שם + נפח + ריכוז).</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {p.offers.map((o) => (
              <OfferLine key={o.id} o={o} liberoPrice={p.price} isRef={e.ref?.id === o.id} onReject={() => onReject(p.id, o.id)} />
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:border-border-strong"
          >
            לעמוד המוצר בליברו ↗
          </a>
          <button
            type="button"
            onClick={() => onIgnore(p.id, !p.ignored)}
            className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg"
          >
            {p.ignored ? "החזר למעקב" : "הסתר מוצר מהמעקב"}
          </button>
        </div>
      </section>
      <section aria-label="היסטוריית מחירים">
        <h3 className="mb-2 text-[12px] font-semibold tracking-[0.04em] text-faint">היסטוריית מחיר</h3>
        <div className="rounded-xl border border-border bg-surface p-3">
          {history ? <HistoryChart points={history} /> : <div className="h-[200px] animate-pulse rounded-lg bg-surface-2" />}
        </div>
      </section>
    </div>
  );
}

function OfferLine({ o, liberoPrice, isRef, onReject }: { o: OfferView; liberoPrice: number; isRef: boolean; onReject: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const diff = liberoPrice - o.price;
  return (
    <li className={`flex items-start gap-3 px-3 py-2.5 ${o.inStock ? "" : "opacity-60"}`}>
      <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: siteColor(o.source) }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13px] font-semibold">{siteName(o.source)}</span>
          <span className="text-[14px] font-semibold tabular">{ils(o.price)}</span>
          {o.inStock && (
            <span className="text-[12px] tabular" style={{ color: diff > 20 ? "var(--pricier)" : diff < -20 ? "var(--cheaper)" : "var(--muted)" }}>
              ליברו <bdi dir="ltr">{signedIls(diff)}</bdi>
            </span>
          )}
          {isRef && <Badge tone="accent">הזול</Badge>}
          {!o.inStock && <Badge>אזל במלאי</Badge>}
          {o.stale && <Badge>לא עדכני</Badge>}
        </div>
        <a href={o.url} target="_blank" rel="noreferrer" dir="auto" className="mt-0.5 block truncate text-[12px] text-muted underline-offset-2 hover:text-fg hover:underline">
          {o.title}
        </a>
        <div className="mt-0.5 text-[11px] text-faint">
          {o.method === "barcode" ? "התאמה לפי ברקוד" : "התאמה לפי שם + נפח + ריכוז"}
          {o.concAssumed && " · האתר לא ציין ריכוז"}
        </div>
      </div>
      {confirm ? (
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onReject} className="h-7 rounded-full bg-pricier px-2.5 text-[12px] font-medium text-white">
            כן, לא אותו מוצר
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="h-7 rounded-full px-2 text-[12px] text-muted hover:text-fg">
            ביטול
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="h-7 shrink-0 rounded-full px-2.5 text-[12px] text-faint transition-colors hover:bg-surface-2 hover:text-fg"
          title="סמן שזו לא אותה התאמה. המערכת לא תתאים את המוצר הזה שוב."
        >
          התאמה שגויה?
        </button>
      )}
    </li>
  );
}

export function GapPill({ gap, gapPct, tone }: { gap: number; gapPct: number | null; tone: { fg: string; bg: string } }) {
  return (
    <span className="inline-flex w-fit shrink-0 items-baseline gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold tabular" style={{ color: tone.fg, background: tone.bg }}>
      <span dir="ltr">{signedIls(gap)}</span>
      {gapPct != null && (
        <span dir="ltr" className="text-[11px] font-medium opacity-80">
          {pct(gapPct)}
        </span>
      )}
    </span>
  );
}

function Thumb({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="blueprint size-10 shrink-0 overflow-hidden rounded-lg border border-border">
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full bg-white object-contain" />
      )}
    </div>
  );
}

export function Badge({ children, tone }: { children: React.ReactNode; tone?: "accent" }) {
  return (
    <span
      className={`inline-flex h-[18px] items-center rounded-full px-1.5 text-[11px] font-medium ${tone === "accent" ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}
    >
      {children}
    </span>
  );
}
