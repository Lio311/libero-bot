"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { SOURCE_KEYS } from "@/lib/config";
import type { HistoryPoint } from "@/lib/data";
import { ils } from "@/lib/format";
import { siteColor, siteName } from "./ui";

// Libero's price and every competitor site's price, one point per daily snapshot (in-stock days
// only, so a sold-out stretch is a gap in that site's line). One axis, all in shekels.
// Libero is the heavy ink line; each site keeps its fixed colour. Legend entries toggle a site.

const H = 200;
const PAD = { top: 12, right: 14, bottom: 24, left: 52 };
const LIBERO = "libero";

const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" });

function niceTicks(lo: number, hi: number, count = 4) {
  const span = Math.max(1, hi - lo);
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 0.5; v += step) ticks.push(Math.round(v));
  return ticks;
}

const valueOf = (p: HistoryPoint, key: string) => (key === LIBERO ? p.libero : (p.prices[key] ?? null));

export function HistoryChart({ points }: { points: HistoryPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // Measure before paint so a phone never flashes the 560px default wider than its card.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setWidth(Math.max(260, Math.round(el.clientWidth)));
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sites that ever had an in-stock price for this product, in the fixed site order (stable colours).
  const sites = useMemo(() => SOURCE_KEYS.filter((k) => points.some((p) => p.prices[k] != null)), [points]);
  const series = useMemo(() => [LIBERO, ...sites.filter((s) => !hidden.has(s))], [sites, hidden]);

  const { x, y, ticks } = useMemo(() => {
    const values = points.flatMap((p) => series.map((k) => valueOf(p, k)).filter((v): v is number => v != null));
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const ticks = niceTicks(lo - (hi - lo) * 0.08 - 1, hi + (hi - lo) * 0.08 + 1);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const innerW = width - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    // Time reads left → right even on a Hebrew page, like every chart axis people know.
    const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
    return { x, y, ticks };
  }, [points, series, width]);

  if (!points.length) return <p className="py-6 text-center text-[13px] text-muted">אין עדיין היסטוריה למוצר הזה.</p>;

  const path = (key: string) => {
    let d = "";
    let pen = false;
    points.forEach((p, i) => {
      const v = valueOf(p, key);
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  };

  const toggle = (s: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const hp = hover != null ? points[hover] : null;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(width / 70))));
  const showDots = points.length < 20;
  const colorOf = (k: string) => (k === LIBERO ? "var(--fg)" : siteColor(k));
  const last = points[points.length - 1];
  // Draw sites first, Libero last so it sits on top.
  const drawOrder = [...series.filter((k) => k !== LIBERO), LIBERO];

  return (
    <div ref={wrap} className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px]">
        <LegendKey color="var(--fg)" label="ליברו" heavy />
        {sites.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            aria-pressed={!hidden.has(s)}
            title={hidden.has(s) ? "הצג את האתר בגרף" : "הסתר את האתר מהגרף"}
            className={`rounded-full px-1 transition-opacity hover:bg-surface-2 ${hidden.has(s) ? "opacity-40" : ""}`}
          >
            <LegendKey color={siteColor(s)} label={siteName(s)} />
          </button>
        ))}
      </div>
      {points.length < 3 && <p className="mb-1 text-[12px] text-faint">הקווים יתמלאו עם כל סריקה יומית.</p>}
      <div dir="ltr">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`היסטוריית מחיר, ${points.length} ימים. היום: ליברו ${ils(last.libero)}${sites
            .filter((s) => last.prices[s] != null)
            .map((s) => `, ${siteName(s)} ${ils(last.prices[s])}`)
            .join("")}`}
          onPointerDown={onMove}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="block touch-pan-y"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--faint)" className="tabular">
                ₪{t.toLocaleString("en-US")}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text key={p.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--faint)" className="tabular">
                {shortDay(p.day)}
              </text>
            ) : null,
          )}
          {hp && <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--border-strong)" strokeWidth={1} />}
          {drawOrder.map((k) => (
            <path
              key={k}
              d={path(k)}
              fill="none"
              stroke={colorOf(k)}
              strokeWidth={k === LIBERO ? 2.75 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {drawOrder.map((k) =>
            points.map((p, i) => {
              const v = valueOf(p, k);
              if (v == null || !(showDots || hover === i)) return null;
              return (
                <circle
                  key={`${k}-${p.day}`}
                  cx={x(i)}
                  cy={y(v)}
                  r={hover === i ? 4.5 : k === LIBERO ? 4 : 3.5}
                  fill={colorOf(k)}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              );
            }),
          )}
        </svg>
      </div>
      {hp && (
        <div
          className="pointer-events-none absolute top-12 z-10 w-[188px] rounded-lg border border-border bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-lift)]"
          style={{ left: x(hover!) > width / 2 ? Math.max(0, x(hover!) - 200) : Math.min(width - 188, x(hover!) + 12) }}
        >
          <div className="mb-1 text-faint">{shortDay(hp.day)}</div>
          {[LIBERO, ...sites.filter((s) => !hidden.has(s) && hp.prices[s] != null)]
            .sort((a, b) => (a === LIBERO ? -1 : b === LIBERO ? 1 : hp.prices[a] - hp.prices[b]))
            .map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 py-px">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-muted">
                  <span className={`w-3 shrink-0 rounded-full ${k === LIBERO ? "h-[3px]" : "h-[2px]"}`} style={{ background: colorOf(k) }} />
                  <span className="truncate">{k === LIBERO ? "ליברו" : siteName(k)}</span>
                </span>
                <span className={`shrink-0 tabular ${k === LIBERO ? "font-semibold text-fg" : "text-fg"}`}>{ils(valueOf(hp, k))}</span>
              </div>
            ))}
          {sites.some((s) => !hidden.has(s) && hp.prices[s] == null) && <div className="mt-1 text-[11px] text-faint">אתרים בלי מחיר ביום הזה: לא במלאי</div>}
        </div>
      )}
    </div>
  );
}

function LegendKey({ color, label, heavy }: { color: string; label: string; heavy?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-1 text-muted">
      <span className={`w-3.5 rounded-full ${heavy ? "h-[3px]" : "h-[2px]"}`} style={{ background: color }} />
      <span className={heavy ? "font-semibold text-fg" : ""}>{label}</span>
    </span>
  );
}
