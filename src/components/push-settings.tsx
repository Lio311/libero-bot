"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useDismiss } from "./ui";

async function api(data?: object) {
  const response = await fetch("/api/push", data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "לא ניתן להתחבר כרגע");
  return result;
}

async function worker() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("הפעלת ההתראות התעכבה. נסה לרענן את הדף.")), 15000);
    navigator.serviceWorker.ready.then((registration) => { window.clearTimeout(timeout); resolve(registration); }, (error) => { window.clearTimeout(timeout); reject(error); });
  });
}

export function PushSettings() {
  const [state, setState] = useState<"loading" | "install" | "unsupported" | "unconfigured" | "off" | "on" | "blocked" | "error">("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      if (ios && !standalone) { setState("install"); return; }
      if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setState("unsupported"); return; }
      try {
        const config = await api();
        if (cancelled) return;
        setPublicKey(config.publicKey);
        if (!config.publicKey) { setState("unconfigured"); return; }
        const registration = await worker();
        const sub = await registration.pushManager.getSubscription();
        const saved = sub ? await api({ action: "status", endpoint: sub.endpoint }) : null;
        if (!cancelled) setState(Notification.permission === "denied" ? "blocked" : saved?.subscribed ? "on" : "off");
      } catch (error) {
        if (!cancelled) { setState("error"); setMessage((error as Error).message); }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function toggle() {
    setOpen(true);
    setBusy(true);
    setMessage("");
    try {
      // Ask directly in the click handler to preserve the user gesture on iOS.
      if (state !== "on") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setState(permission === "denied" ? "blocked" : "off"); return; }
      }
      const registration = await worker();
      let sub = await registration.pushManager.getSubscription();
      if (state === "on") {
        if (sub) {
          await api({ action: "unsubscribe", endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
        setState("off");
        setMessage("ההתראות במכשיר הזה כבויות");
      } else {
        if (!publicKey) throw new Error("ההתראות עדיין לא הוגדרו באתר");
        const raw = atob(publicKey.replace(/-/g, "+").replace(/_/g, "/"));
        const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        // Key rotation requires a fresh browser subscription.
        if (sub) {
          const currentKey = sub.options.applicationServerKey;
          if (currentKey && bufferKey(currentKey) !== bufferKey(key.buffer)) { await sub.unsubscribe(); sub = null; }
        }
        sub ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await api({ action: "subscribe", ...sub.toJSON() });
        setState("on");
        setMessage("ההתראות הופעלו במכשיר הזה");
      }
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function test() {
    setBusy(true);
    try {
      const sub = await (await worker()).pushManager.getSubscription();
      if (!sub) { setState("off"); throw new Error("יש להפעיל התראות קודם"); }
      await api({ action: "test", endpoint: sub.endpoint });
      setMessage("התראת הבדיקה נשלחה למכשיר");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  const hint = {
    loading: "בודק תמיכה בהתראות…",
    install: "באייפון: שיתוף ← הוסף למסך הבית. פתח את liberoBot מהאייקון החדש והפעל התראות (iOS 16.4 ומעלה).",
    unsupported: "הדפדפן הזה לא תומך בהתראות. נסה דפדפן מעודכן במכשיר שלך.",
    unconfigured: "ההתראות יהיו זמינות אחרי השלמת ההגדרה באתר.",
    off: "סיכום הבוקר והתראות על כשל בסריקה, גם כשהאתר סגור.",
    on: "סיכום הבוקר והתראות על כשל בסריקה יגיעו למכשיר הזה.",
    blocked: "ההתראות חסומות. אפשר לאפשר אותן בהגדרות האתר או המכשיר ולפתוח מחדש.",
    error: "לא ניתן לבדוק את ההתראות כרגע. נסה לרענן את הדף.",
  }[state];
  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label={state === "on" ? "התראות פעילות" : "התראות"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (state === "off") void toggle();
          else setOpen((value) => !value);
        }}
        disabled={busy}
        title={state === "on" ? "התראות פעילות" : "התראות"}
        className={`relative inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface transition-colors hover:border-border-strong disabled:opacity-60 ${state === "on" ? "text-accent" : "text-muted hover:text-fg"}`}
      >
        <svg viewBox="0 0 20 20" className="size-4.5" fill="none" aria-hidden>
          <path d="M5 8a5 5 0 0 1 10 0v3l1.3 2.4a.7.7 0 0 1-.6 1H4.3a.7.7 0 0 1-.6-1L5 11V8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 17a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {state === "on" && <span aria-hidden className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" />}
      </button>
      {open && (
        <div id={panelId} className="absolute left-0 top-full z-40 mt-2 w-[min(288px,calc(100vw-32px))] rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">התראות למכשיר</p>
            <button type="button" onClick={close} aria-label="סגור התראות" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2">×</button>
          </div>
          <p role="status" aria-live="polite" className="mt-1 text-[13px] leading-relaxed text-muted">{message || hint}</p>
          {(state === "on" || state === "off") && (
            <button type="button" onClick={toggle} disabled={busy} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-fg px-4 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60">
              {busy ? "רגע…" : state === "on" ? "כבה התראות במכשיר הזה" : "הפעל התראות"}
            </button>
          )}
          {state === "on" && <button type="button" disabled={busy} onClick={test} className="mt-2 min-h-11 w-full rounded-[10px] border border-border px-3 text-[13px] text-muted transition-colors hover:border-border-strong hover:text-fg disabled:opacity-60">שלח בדיקה</button>}
        </div>
      )}
    </div>
  );
}

function bufferKey(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).join(",");
}
