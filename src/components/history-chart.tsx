"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HistoryPoint } from "@/lib/data";
import { ils } from "@/lib/format";
import { siteName } from "./ui";

// Libero's price vs the cheapest in-stock competitor, one point per daily snapshot.
// Two series on one axis (both are shekels), crosshair + tooltip listing every site that day.

const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 48 };

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

export function HistoryChart({ points }: { points: HistoryPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { x, y, ticks } = useMemo(() => {
    const values = points.flatMap((p) => [p.libero, ...(p.min != null ? [p.min] : [])]);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const ticks = niceTicks(lo - (hi - lo) * 0.1 - 1, hi + (hi - lo) * 0.1 + 1);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const innerW = width - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    // RTL page, but time still reads left → right in charts (like the axis labels on every chart people know).
    const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
    return { x, y, ticks };
  }, [points, width]);

  if (!points.length) return <p className="py-6 text-center text-[13px] text-muted">אין עדיין היסטוריה למוצר הזה.</p>;

  const path = (get: (p: HistoryPoint) => number | null) => {
    let d = "";
    let pen = false;
    points.forEach((p, i) => {
      const v = get(p);
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
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(width / 70))));
  const last = points[points.length - 1];

  return (
    <div ref={wrap} className="relative" dir="ltr">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[12px] text-muted" dir="rtl">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[2px] w-3.5 rounded-full" style={{ background: "var(--chart-libero)" }} />
          ליברו
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[2px] w-3.5 rounded-full" style={{ background: "var(--chart-market)" }} />
          הזול בשוק
        </span>
        {points.length < 3 && <span className="text-faint">הגרף יתמלא עם כל סריקה יומית</span>}
      </div>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`מחיר ליברו מול הזול בשוק, ${points.length} ימים. היום: ליברו ${ils(last.libero)}, הזול בשוק ${ils(last.min)}`}
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
        <path d={path((p) => p.min)} fill="none" stroke="var(--chart-market)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={path((p) => p.libero)} fill="none" stroke="var(--chart-libero)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.day}>
            {p.min != null && (points.length < 20 || hover === i) && (
              <circle cx={x(i)} cy={y(p.min)} r={hover === i ? 4.5 : 3.5} fill="var(--chart-market)" stroke="var(--surface)" strokeWidth={2} />
            )}
            {(points.length < 20 || hover === i) && (
              <circle cx={x(i)} cy={y(p.libero)} r={hover === i ? 4.5 : 3.5} fill="var(--chart-libero)" stroke="var(--surface)" strokeWidth={2} />
            )}
          </g>
        ))}
      </svg>
      {hp && (
        <div
          dir="rtl"
          className="pointer-events-none absolute top-6 z-10 min-w-[150px] rounded-lg border border-border bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-lift)]"
          style={x(hover!) > width / 2 ? { right: width - x(hover!) + 10 } : { left: x(hover!) + 10 }}
        >
          <div className="mb-1 text-faint">{shortDay(hp.day)}</div>
          <Row color="var(--chart-libero)" label="ליברו" value={hp.libero} />
          <Row color="var(--chart-market)" label="הזול בשוק" value={hp.min} />
          {Object.entries(hp.prices)
            .sort((a, b) => a[1] - b[1])
            .map(([s, v]) => (
              <div key={s} className="flex justify-between gap-4 text-muted">
                <span className="tabular">{ils(v)}</span>
                <span>{siteName(s)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-semibold tabular text-fg">{ils(value)}</span>
      <span className="inline-flex items-center gap-1.5 text-muted">
        {label}
        <span className="h-[2px] w-3 rounded-full" style={{ background: color }} />
      </span>
    </div>
  );
}
