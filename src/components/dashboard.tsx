"use client";

import { motion } from "motion/react";
import { useCallback, useDeferredValue, useMemo, useState, useTransition, type ReactNode } from "react";
import { rejectMatch, setIgnored } from "@/lib/actions";
import { SAME_PRICE_BAND, SOURCE_KEYS, SOURCES, verdictFor, type SourceKey, type Verdict } from "@/lib/config";
import type { DashboardData, ProductView } from "@/lib/data";
import { CONC_LABEL, dayLabel, ils, timeLabel } from "@/lib/format";
import { Chip, RangeSlider, Segmented, Select, Toggle, buildHistogram } from "./controls";
import { Logo } from "./logo";
import { GRID, ProductRow, VERDICT_TONE, type Evaluated } from "./product-row";
import { BottomSheet, EASE, FilterButton, FilterSection, FiltersPopover, SearchField, StatusPill, siteName } from "./ui";

const PAGE = 50;

type Sort = "gap" | "gapPct" | "priceDesc" | "priceAsc" | "sites" | "stock" | "name";
const SORTS: { value: Sort; label: string }[] = [
  { value: "gap", label: "פער גדול (₪)" },
  { value: "gapPct", label: "פער גדול (%)" },
  { value: "priceDesc", label: "מחיר ליברו: גבוה לנמוך" },
  { value: "priceAsc", label: "מחיר ליברו: נמוך לגבוה" },
  { value: "sites", label: "הכי הרבה מתחרים" },
  { value: "stock", label: "מלאי אצלי: גבוה לנמוך" },
  { value: "name", label: "שם (א-ת)" },
];

const TABS: { value: Verdict; label: string; short?: string; hint: string }[] = [
  { value: "pricier", label: "ליברו יקרים יותר", hint: `יותר מ-₪${SAME_PRICE_BAND} מעל הזול` },
  { value: "cheaper", label: "ליברו זולים יותר", hint: `יותר מ-₪${SAME_PRICE_BAND} מתחת לזול` },
  { value: "same", label: "מחיר זהה", hint: `פער של עד ₪${SAME_PRICE_BAND}` },
  { value: "unmatched", label: "לא נמצא אצל מתחרים", short: "ללא מתחרים", hint: "אין התאמה במלאי" },
];

/** Libero categories worth filtering by (the store files most products under several). */
const SEGMENTS = ["בשמי בוטיק ונישה", "בשמי יוקרה", "בושם דובאי", "מותגי הבית", "מציאון וטסטרים", "חדש בליברו", "יוניסקס"];

interface Filters {
  against: "cheapest" | SourceKey;
  brand: string;
  segment: string;
  kind: "all" | "regular" | "tester";
  conc: string[];
  price: [number, number] | null;
  gap: [number, number] | null;
  minSites: number;
  changed: boolean;
  onSale: boolean;
  lowStock: boolean;
  barcodeOnly: boolean;
  ignored: boolean;
}

const NO_FILTERS: Filters = {
  against: "cheapest",
  brand: "all",
  segment: "all",
  kind: "all",
  conc: [],
  price: null,
  gap: null,
  minSites: 1,
  changed: false,
  onSale: false,
  lowStock: false,
  barcodeOnly: false,
  ignored: false,
};

/** Filters that live in the popover / sheet (the bar shows site, brand and sort). */
function countAdvanced(f: Filters) {
  return (
    (f.segment !== "all" ? 1 : 0) +
    (f.kind !== "all" ? 1 : 0) +
    (f.conc.length ? 1 : 0) +
    (f.price ? 1 : 0) +
    (f.gap ? 1 : 0) +
    (f.minSites > 1 ? 1 : 0) +
    [f.changed, f.onSale, f.lowStock, f.barcodeOnly, f.ignored].filter(Boolean).length
  );
}
const countAll = (f: Filters) => countAdvanced(f) + (f.against !== "cheapest" ? 1 : 0) + (f.brand !== "all" ? 1 : 0);

/** Verdict against the cheapest in-stock competitor, or against one chosen site. */
function evaluate(p: ProductView, against: Filters["against"]): Evaluated {
  const live = p.offers.filter((o) => o.inStock);
  const pool = against === "cheapest" ? live : live.filter((o) => o.source === against);
  const ref = pool.length ? pool.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  const gap = ref ? p.price - ref.price : null;
  const verdict = verdictFor(gap);
  const changed =
    !!p.prev && (p.prev.verdict !== p.verdict || p.prev.price !== p.price || (p.prev.minPrice ?? 0) !== (p.minPrice ?? 0));
  return { p, verdict, gap, gapPct: ref && gap != null ? gap / ref.price : null, ref, live, changed };
}

function sortRows(rows: Evaluated[], sort: Sort) {
  const by: Record<Sort, (a: Evaluated, b: Evaluated) => number> = {
    gap: (a, b) => Math.abs(b.gap ?? -1) - Math.abs(a.gap ?? -1) || b.p.price - a.p.price,
    gapPct: (a, b) => Math.abs(b.gapPct ?? -1) - Math.abs(a.gapPct ?? -1),
    priceDesc: (a, b) => b.p.price - a.p.price,
    priceAsc: (a, b) => a.p.price - b.p.price,
    sites: (a, b) => b.live.length - a.live.length || Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0),
    stock: (a, b) => (b.p.stockQty ?? -1) - (a.p.stockQty ?? -1),
    name: (a, b) => a.p.name.localeCompare(b.p.name, "he"),
  };
  return [...rows].sort(by[sort]);
}

const normalize = (s: string) => s.toLowerCase().replace(/['"״׳]/g, "");

export function Dashboard({ data }: { data: DashboardData }) {
  const [products, setProducts] = useState(data.products);
  const [tab, setTab] = useState<Verdict>("pricier");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<Sort>("gap");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query);
  const [openId, setOpenId] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [popover, setPopover] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const set = useCallback(<K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setLimit(PAGE);
  }, []);

  // Bounds for the sliders, from the whole catalog.
  const priceMax = useMemo(() => Math.max(500, Math.ceil(Math.max(...products.map((p) => p.price)) / 100) * 100), [products]);
  const evaluatedAll = useMemo(() => products.map((p) => evaluate(p, filters.against)), [products, filters.against]);
  const gapMax = useMemo(() => {
    const m = Math.max(100, ...evaluatedAll.map((e) => Math.abs(e.gap ?? 0)));
    return Math.ceil(m / 50) * 50;
  }, [evaluatedAll]);

  const brands = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of products) if (p.brand) c.set(p.brand, (c.get(p.brand) ?? 0) + 1);
    return [...c].sort((a, b) => a[0].localeCompare(b[0], "en"));
  }, [products]);

  // Everything except the verdict tab: the cards count over this set.
  const filtered = useMemo(() => {
    const needle = normalize(q.trim());
    return evaluatedAll.filter((e) => {
      const { p } = e;
      if (filters.ignored !== p.ignored) return false;
      if (filters.brand !== "all" && p.brand !== filters.brand) return false;
      if (filters.segment !== "all" && !p.categories.includes(filters.segment)) return false;
      if (filters.kind === "tester" && !p.tester) return false;
      if (filters.kind === "regular" && p.tester) return false;
      if (filters.conc.length && !filters.conc.includes(p.conc ?? "")) return false;
      if (filters.price && (p.price < filters.price[0] || (filters.price[1] < priceMax && p.price > filters.price[1]))) return false;
      if (filters.gap) {
        const g = Math.abs(e.gap ?? 0);
        if (e.gap == null || g < filters.gap[0] || (filters.gap[1] < gapMax && g > filters.gap[1])) return false;
      }
      if (filters.minSites > 1 && e.live.length < filters.minSites) return false;
      if (filters.changed && !e.changed) return false;
      if (filters.onSale && !p.onSale) return false;
      if (filters.lowStock && !(p.stockQty != null && p.stockQty <= 2)) return false;
      if (filters.barcodeOnly && e.ref?.method !== "barcode") return false;
      if (needle && !normalize(`${p.name} ${p.brand ?? ""} ${p.sku ?? ""} ${p.id}`).includes(needle)) return false;
      return true;
    });
  }, [evaluatedAll, filters, q, priceMax, gapMax]);

  const counts = useMemo(() => {
    const c: Record<Verdict, number> = { pricier: 0, cheaper: 0, same: 0, unmatched: 0 };
    const prev: Record<Verdict, number> = { pricier: 0, cheaper: 0, same: 0, unmatched: 0 };
    let withPrev = 0;
    for (const e of filtered) {
      c[e.verdict]++;
      if (e.p.prev) {
        prev[e.p.prev.verdict]++;
        withPrev++;
      }
    }
    return { c, prev: filters.against === "cheapest" && withPrev ? prev : null };
  }, [filtered, filters.against]);

  const rows = useMemo(() => sortRows(filtered.filter((e) => e.verdict === tab), tab === "unmatched" && sort === "gap" ? "priceDesc" : sort), [filtered, tab, sort]);
  const shown = rows.slice(0, limit);
  const activeCount = countAll(filters);
  const advancedCount = countAdvanced(filters);

  const onToggle = useCallback((id: number) => setOpenId((o) => (o === id ? null : id)), []);

  const onReject = useCallback((productId: number, offerId: number) => {
    // Optimistic: drop the offer locally; the server also fixes today's snapshot.
    setProducts((ps) => ps.map((p) => (p.id === productId ? { ...p, offers: p.offers.filter((o) => o.id !== offerId) } : p)));
    startTransition(async () => {
      const r = await rejectMatch(offerId);
      setToast(r.ok ? "סומן כהתאמה שגויה. המוצר לא יותאם שוב לפריט הזה." : "השמירה נכשלה, נסה לרענן את הדף");
      window.setTimeout(() => setToast(null), 3500);
    });
  }, []);

  const onIgnore = useCallback((productId: number, ignored: boolean) => {
    setProducts((ps) => ps.map((p) => (p.id === productId ? { ...p, ignored } : p)));
    setOpenId(null);
    startTransition(async () => {
      const r = await setIgnored(productId, ignored);
      setToast(r.ok ? (ignored ? "המוצר הוסתר. אפשר להחזיר אותו מ׳סינון נוסף ← מוסתרים׳." : "המוצר חזר למעקב") : "השמירה נכשלה, נסה לרענן את הדף");
      window.setTimeout(() => setToast(null), 3500);
    });
  }, []);

  const reset = () => {
    setFilters(NO_FILTERS);
    setQuery("");
    setLimit(PAGE);
  };

  const againstOptions = [
    { value: "cheapest", label: "מול הזול בשוק" },
    ...SOURCE_KEYS.map((k) => ({ value: k, label: `מול ${SOURCES[k].name}` })),
  ] as { value: Filters["against"]; label: string }[];
  const brandOptions = [{ value: "all", label: "כל המותגים" }, ...brands.map(([b, n]) => ({ value: b, label: `${b} (${n})` }))];
  const total = products.filter((p) => !p.ignored).length;

  const advanced = (
    <>
      <FilterSection title="סוג">
        <Segmented
          id={sheet ? "kind-sheet" : "kind-pop"}
          full
          value={filters.kind}
          onChange={(v) => set("kind", v)}
          options={[
            { value: "all", label: "הכל" },
            { value: "regular", label: "רגיל" },
            { value: "tester", label: "טסטר" },
          ]}
        />
      </FilterSection>
      <FilterSection title="ריכוז">
        <div className="flex flex-wrap gap-2">
          {Object.entries(CONC_LABEL).map(([k, label]) => (
            <Chip key={k} active={filters.conc.includes(k)} onClick={() => set("conc", filters.conc.includes(k) ? filters.conc.filter((c) => c !== k) : [...filters.conc, k])}>
              {label}
            </Chip>
          ))}
        </div>
      </FilterSection>
      <FilterSection title="קטגוריה בליברו">
        <div className="flex flex-wrap gap-2">
          {SEGMENTS.map((s) => (
            <Chip key={s} active={filters.segment === s} onClick={() => set("segment", filters.segment === s ? "all" : s)}>
              {s}
            </Chip>
          ))}
        </div>
      </FilterSection>
      <FilterSection title="מחיר בליברו">
        <div dir="ltr">
          <RangeSlider
            label="מחיר בליברו"
            min={0}
            max={priceMax}
            step={50}
            value={filters.price ?? [0, priceMax]}
            onChange={(v) => set("price", v[0] === 0 && v[1] === priceMax ? null : v)}
            format={(v, open) => (open ? `${ils(v)}+` : ils(v))}
            openEnd
            histogram={buildHistogram(products.map((p) => p.price), 0, priceMax, 32)}
          />
        </div>
      </FilterSection>
      <FilterSection title="גודל הפער (₪, לכל כיוון)">
        <div dir="ltr">
          <RangeSlider
            label="גודל הפער"
            min={0}
            max={gapMax}
            step={10}
            value={filters.gap ?? [0, gapMax]}
            onChange={(v) => set("gap", v[0] === 0 && v[1] === gapMax ? null : v)}
            format={(v, open) => (open ? `${ils(v)}+` : ils(v))}
            openEnd
            histogram={buildHistogram(evaluatedAll.filter((e) => e.gap != null).map((e) => Math.abs(e.gap!)), 0, gapMax, 32)}
          />
        </div>
      </FilterSection>
      <FilterSection title="נמצא אצל לפחות">
        <Segmented
          id={sheet ? "sites-sheet" : "sites-pop"}
          full
          value={filters.minSites}
          onChange={(v) => set("minSites", v)}
          options={[1, 2, 3, 4].map((n) => ({ value: n, label: n === 1 ? "אתר אחד" : `${n} אתרים` }))}
        />
      </FilterSection>
      <FilterSection>
        <div className="flex flex-col items-start gap-1">
          <Toggle on={filters.changed} onChange={(v) => set("changed", v)}>
            רק מה שהשתנה מאתמול
          </Toggle>
          <Toggle on={filters.onSale} onChange={(v) => set("onSale", v)}>
            רק מוצרים במבצע אצלי
          </Toggle>
          <Toggle on={filters.lowStock} onChange={(v) => set("lowStock", v)}>
            מלאי נמוך אצלי (2 ומטה)
          </Toggle>
          <Toggle on={filters.barcodeOnly} onChange={(v) => set("barcodeOnly", v)}>
            רק התאמות לפי ברקוד
          </Toggle>
          <Toggle on={filters.ignored} onChange={(v) => set("ignored", v)}>
            הצג מוצרים מוסתרים
          </Toggle>
        </div>
      </FilterSection>
    </>
  );

  return (
    <div dir="rtl" className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-4 sm:px-6">
          <Logo />
          <StatusPill status={data.status} lastRun={data.lastRun} now={data.now} />
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
        <section className="pt-6 sm:pt-10">
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">
            ליברו מול השוק. <span className="text-muted">איפה אתה יקר, ואיפה זול.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted sm:text-[14px]">
            {data.day ? (
              <>
                {total.toLocaleString("en-US")} מוצרים במלאי נבדקו מול {SOURCE_KEYS.length} אתרים · {dayLabel(data.day)}
                {data.lastRun && <> · {timeLabel(data.lastRun)}</>}. מחיר זהה = פער של עד ₪{SAME_PRICE_BAND}.
              </>
            ) : (
              "הסריקה הראשונה עוד לא רצה. הנתונים יופיעו כאן אחריה."
            )}
          </p>

          <div role="tablist" aria-label="קטגוריה" className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-3 lg:grid-cols-4">
            {TABS.map((t) => (
              <VerdictCard
                key={t.value}
                active={tab === t.value}
                onClick={() => {
                  setTab(t.value);
                  setLimit(PAGE);
                  setOpenId(null);
                }}
                label={t.label}
                short={t.short}
                hint={t.hint}
                count={counts.c[t.value]}
                prev={counts.prev?.[t.value]}
                tone={VERDICT_TONE[t.value]}
              />
            ))}
          </div>
        </section>

        {/* Filter bar */}
        <div className="sticky top-14 z-20 -mx-4 mt-6 border-b border-border/70 bg-bg/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-2">
            <SearchField value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} className="min-w-0 flex-1 lg:max-w-[300px]" />
            <div className="hidden items-center gap-2 lg:flex">
              <Select label="השוואה" value={filters.against} onChange={(v) => set("against", v)} options={againstOptions} />
              <Select label="מותג" value={filters.brand} onChange={(v) => set("brand", v)} options={brandOptions} />
              <Select label="מיון" value={sort} onChange={setSort} options={SORTS} />
              <FiltersPopover open={popover} onOpenChange={setPopover} count={advancedCount} onReset={() => setFilters((f) => ({ ...NO_FILTERS, against: f.against, brand: f.brand }))}>
                {advanced}
              </FiltersPopover>
            </div>
            <div className="lg:hidden">
              <FilterButton label="סינון" count={activeCount} open={sheet} onClick={() => setSheet(true)} />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
          <span>
            <span className="font-semibold text-fg tabular">{rows.length}</span> מוצרים
            {filters.against !== "cheapest" && <> · מושווה מול {siteName(filters.against)} בלבד</>}
          </span>
          {(activeCount > 0 || query) && (
            <button type="button" onClick={reset} className="font-medium text-fg underline-offset-4 hover:underline">
              נקה סינון ({activeCount + (query ? 1 : 0)})
            </button>
          )}
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]">
          <div className={`hidden border-b border-border px-5 py-2.5 text-[12px] font-medium text-faint ${GRID}`}>
            <span>מוצר</span>
            <span>ליברו</span>
            <span>{filters.against === "cheapest" ? "הזול בשוק" : siteName(filters.against)}</span>
            <span>פער</span>
            <span>מחזיקים</span>
            <span />
          </div>
          {shown.length ? (
            <ul>
              {shown.map((e) => (
                <ProductRow key={e.p.id} e={e} open={openId === e.p.id} onToggle={onToggle} onReject={onReject} onIgnore={onIgnore} />
              ))}
            </ul>
          ) : (
            <Empty hasData={products.length > 0} filtered={activeCount > 0 || !!query} onReset={reset} />
          )}
        </div>
        {rows.length > shown.length && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <span className="text-[12px] text-faint tabular">
              מוצגים {shown.length} מתוך {rows.length}
            </span>
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="h-10 rounded-full border border-border bg-surface px-5 text-[13px] font-medium transition-[border-color,scale] hover:border-border-strong active:scale-[0.97]"
            >
              הצג עוד
            </button>
          </div>
        )}
      </main>

      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="סינון ומיון"
        footer={
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={reset} className="h-11 px-1 text-[14px] font-medium underline-offset-4 hover:underline">
              נקה הכל
            </button>
            <button type="button" onClick={() => setSheet(false)} className="h-11 flex-1 rounded-xl bg-fg text-[14px] font-semibold text-bg active:scale-[0.98]">
              הצג {rows.length} מוצרים
            </button>
          </div>
        }
      >
        <FilterSection title="השוואה">
          <Select label="השוואה" value={filters.against} onChange={(v) => set("against", v)} options={againstOptions} className="w-full" />
        </FilterSection>
        <FilterSection title="מותג">
          <Select label="מותג" value={filters.brand} onChange={(v) => set("brand", v)} options={brandOptions} className="w-full" />
        </FilterSection>
        <FilterSection title="מיון">
          <Select label="מיון" value={sort} onChange={setSort} options={SORTS} className="w-full" />
        </FilterSection>
        {advanced}
      </BottomSheet>

      {toast && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-xl bg-fg px-4 py-3 text-center text-[13px] font-medium text-bg shadow-[var(--shadow-lift)]"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

function VerdictCard({
  active,
  onClick,
  label,
  short,
  hint,
  count,
  prev,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  /** Phone label when the full one would wrap in a half-width card. */
  short?: string;
  hint: string;
  count: number;
  prev?: number;
  tone: { fg: string; bg: string };
}) {
  const delta = prev == null ? null : count - prev;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative min-w-0 rounded-2xl border p-3.5 text-start transition-[border-color,box-shadow,scale] duration-150 active:scale-[0.98] sm:p-5 ${
        active ? "border-transparent shadow-[var(--shadow-lift)]" : "border-border bg-surface hover:border-border-strong"
      }`}
      style={active ? { background: tone.bg, boxShadow: `inset 0 0 0 1.5px ${tone.fg}, var(--shadow-lift)` } : undefined}
    >
      <div className="flex items-start gap-2 text-[13px] font-semibold leading-snug" style={{ color: tone.fg }}>
        <span className="mt-[5px] size-2 shrink-0 rounded-full" style={{ background: tone.fg }} />
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[28px] font-semibold leading-none tracking-[-0.03em] tabular sm:text-[34px]">{count.toLocaleString("en-US")}</span>
        {delta != null && delta !== 0 && (
          <span className="text-[12px] font-medium tabular text-muted" dir="ltr">
            {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[12px] text-muted">{hint}</div>
    </button>
  );
}

function Empty({ hasData, filtered, onReset }: { hasData: boolean; filtered: boolean; onReset: () => void }): ReactNode {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="blueprint mb-4 grid size-12 place-items-center rounded-2xl text-faint">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
          <path d="M9 3h6l1 4H8l1-4ZM7 7h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="text-[15px] font-semibold">{!hasData ? "עוד אין נתונים" : filtered ? "אין מוצרים שמתאימים לסינון" : "אין מוצרים בקטגוריה הזו"}</h2>
      <p className="mt-1 max-w-sm text-[13px] text-muted">
        {!hasData ? "הסריקה הלילית תמלא את הדשבורד. אפשר גם להריץ אותה ידנית מ-GitHub Actions." : filtered ? "נסה להרחיב את הסינון או לנקות אותו." : "נסה קטגוריה אחרת למעלה."}
      </p>
      {filtered && (
        <button type="button" onClick={onReset} className="mt-4 h-9 rounded-full bg-fg px-4 text-[13px] font-medium text-bg active:scale-[0.97]">
          נקה סינון
        </button>
      )}
    </div>
  );
}
