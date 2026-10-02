"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SOURCES, type SourceKey } from "@/lib/config";
import type { SourceStatus } from "@/lib/data";
import { relativeTime } from "@/lib/format";

export const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const LG = "(min-width: 1024px)";

export const siteName = (s: string) => SOURCES[s as SourceKey]?.name ?? s;
export const siteColor = (s: string) => SOURCES[s as SourceKey]?.color ?? "var(--faint)";

/** Closes on outside press and Escape while `open`. */
export function useDismiss(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, ref]);
}

export function SearchField({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  // RTL: text starts on the right, the magnifier (or the clear button once there's text) sits on the left.
  return (
    <label
      className={`relative flex h-9 items-center rounded-[10px] border border-border bg-surface transition-colors focus-within:border-accent hover:border-border-strong ${className}`}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="חיפוש מוצר, מותג או ברקוד"
        aria-label="חיפוש מוצר, מותג או ברקוד"
        enterKeyHint="search"
        dir="rtl"
        className="size-full min-w-0 bg-transparent ps-3 pe-9 text-right text-[16px] outline-none placeholder:text-faint sm:text-[13px]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="נקה חיפוש"
          className="absolute end-1.5 grid size-6 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-fg"
        >
          <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden>
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      ) : (
        <svg className="pointer-events-none absolute end-3 size-3.5 text-faint" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
    </label>
  );
}

export function FilterButton({ label, count, open, onClick }: { label: string; count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={count ? `${label}, ${count} פעילים` : label}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border bg-surface px-3 text-[13px] font-medium transition-[border-color,color,scale] duration-150 ease-out active:scale-[0.97] ${
        count || open ? "border-border-strong text-fg" : "border-border text-muted hover:border-border-strong hover:text-fg"
      }`}
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
        <path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {label}
      <AnimatePresence initial={false}>
        {count > 0 && (
          <motion.span
            key="badge"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-none text-accent-fg tabular"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/** Desktop "more filters": an anchored popover. Closes on outside press and Escape. */
export function FiltersPopover({
  open,
  onOpenChange,
  count,
  onReset,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onReset: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useDismiss(open, () => onOpenChange(false), ref);
  return (
    <div ref={ref} className="relative shrink-0">
      <FilterButton label="סינון נוסף" count={count} open={open} onClick={() => onOpenChange(!open)} />
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="סינון נוסף"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.18, ease: EASE }}
            style={{ transformOrigin: "top left" }}
            className="absolute end-0 top-[calc(100%+8px)] z-40 flex max-h-[calc(100dvh-160px)] w-[420px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lift)]"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">{children}</div>
            <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={onReset}
                disabled={count === 0}
                className="h-9 rounded-lg px-1 text-[13px] font-medium text-fg underline-offset-4 transition-[color,scale] duration-150 hover:underline active:scale-[0.97] disabled:pointer-events-none disabled:text-faint"
              >
                איפוס
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-9 rounded-full bg-fg px-4 text-[13px] font-medium text-bg transition-[scale] duration-150 active:scale-[0.97]"
              >
                סיום
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Mobile bottom sheet: slides up over a dimmed backdrop; drag the handle/header down to dismiss
 * (> 90px or a fast flick), Escape or a backdrop tap closes. Locks page scroll while open.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const controls = useDragControls();
  const reduce = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const mq = window.matchMedia(LG);
    const onMq = () => mq.matches && onClose();
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          aria-hidden
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
        />
      )}
      {open && (
        <motion.div
          key="sheet"
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          initial={reduce ? { opacity: 0 } : { y: "100%" }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: "100%" }}
          transition={{ type: "tween", duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
          drag={reduce ? false : "y"}
          dragListener={false}
          dragControls={controls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.04, bottom: 1 }}
          dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 90 || info.velocity.y > 500) onClose();
          }}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[20px] border-t border-border bg-surface shadow-[0_-16px_48px_-16px_rgb(0_0_0/0.3)] outline-none lg:hidden"
        >
          <div
            onPointerDown={(e) => {
              if (!(e.target as HTMLElement).closest("button")) controls.start(e);
            }}
            className="shrink-0 cursor-grab touch-none px-4 pb-1 pt-2 active:cursor-grabbing"
          >
            <div className="mx-auto h-1 w-9 rounded-full bg-border-strong" />
            <div className="mt-2 flex h-9 items-center justify-between">
              <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="סגירה"
                className="-me-1.5 grid size-9 place-items-center rounded-full text-muted transition-[background-color,color,scale] duration-150 hover:bg-surface-2 hover:text-fg active:scale-[0.94]"
              >
                <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
                  <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border px-4">{children}</div>
          <div className="shrink-0 border-t border-border px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">{footer}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FilterSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="border-b border-border py-5 last:border-b-0">
      {title && <h3 className="mb-3 text-[13px] font-semibold text-fg">{title}</h3>}
      {children}
    </section>
  );
}

const STATUS_COLOR: Record<string, string> = {
  ok: "var(--cheaper)",
  skipped: "var(--faint)",
  running: "var(--faint)",
  blocked: "#d97706",
  error: "#dc2626",
};
const STATUS_HE: Record<string, string> = { blocked: "חסום", error: "שגיאה", running: "רץ כעת", skipped: "דולג" };

export function StatusPill({ status, lastRun, now }: { status: SourceStatus[]; lastRun: string | null; now: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const healthy = status.filter((s) => s.status === "ok").length;
  const problems = status.some((s) => s.status === "blocked" || s.status === "error");
  const dot = problems ? STATUS_COLOR.blocked : STATUS_COLOR.ok;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-muted transition-[border-color,color,scale] duration-150 hover:border-border-strong hover:text-fg active:scale-[0.97]"
      >
        <span className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ background: dot }} />
          <span className="relative size-2 rounded-full" style={{ background: dot }} />
        </span>
        <span className="hidden sm:inline">עודכן</span> {relativeTime(lastRun, now)}
        <span className="text-faint tabular">
          · {healthy}/{status.length}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: EASE }}
            style={{ transformOrigin: "top left" }}
            className="absolute end-0 top-10 z-50 w-[320px] max-w-[calc(100vw-32px)] rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow-lift)]"
          >
            <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold tracking-[0.04em] text-faint">אתרים · סריקה אחרונה</div>
            {status.length === 0 && <div className="px-2.5 py-2 text-[13px] text-muted">עוד לא רצה סריקה.</div>}
            {status.map((s) => (
              <div key={s.source} className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-surface-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[s.status] ?? "var(--faint)" }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-medium">{siteName(s.source)}</span>
                    <span className="text-[12px] text-faint">{relativeTime(s.finishedAt, now)}</span>
                  </div>
                  <div className="truncate text-[12px] text-muted" title={s.message ?? undefined}>
                    {s.status === "ok"
                      ? `${s.found.toLocaleString("en-US")} מוצרים באתר · ${s.matched} תואמים לליברו`
                      : `${STATUS_HE[s.status] ?? s.status}${s.message ? `: ${s.message}` : ""}`}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
