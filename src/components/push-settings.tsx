"use client";

import { useEffect, useState } from "react";

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
    <section aria-label="התראות למכשיר" className="mt-5 rounded-xl border border-border bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold">התראות למכשיר{state === "on" ? " · פעילות" : ""}</h2>
          <p className="mt-1 text-[12px] text-muted">{hint}</p>
        </div>
        {(state === "on" || state === "off") && <div className="flex gap-2">
          {state === "on" && <button type="button" disabled={busy} onClick={test} className="min-h-10 rounded-lg border border-border px-3 text-[12px] disabled:opacity-50">שלח בדיקה</button>}
          <button type="button" disabled={busy} onClick={toggle} className="min-h-10 rounded-lg bg-fg px-3 text-[12px] font-medium text-bg disabled:opacity-50">{busy ? "רגע…" : state === "on" ? "כבה התראות" : "הפעל התראות"}</button>
        </div>}
      </div>
      <p role="status" aria-live="polite" className="text-[12px] text-muted">{message}</p>
    </section>
  );
}

function bufferKey(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).join(",");
}
