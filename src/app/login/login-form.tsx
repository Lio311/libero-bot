"use client";

import { useActionState } from "react";
import { Logo } from "@/components/logo";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, { error: null });
  return (
    <main dir="rtl" className="grid min-h-dvh place-items-center px-4">
      <form action={action} className="w-full max-w-[360px] rounded-2xl border border-border bg-surface p-7 shadow-[var(--shadow-card)]">
        <Logo />
        <h1 className="mt-6 text-[22px] font-semibold tracking-[-0.02em]">השוואת מחירים מול מתחרים</h1>
        <p className="mt-1 text-[14px] text-muted">הכניסה בקוד גישה בלבד.</p>
        <input type="hidden" name="next" value={next} />
        <label className="mt-6 block text-[13px] font-medium" htmlFor="passcode">
          קוד גישה
        </label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          dir="ltr"
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "passcode-error" : undefined}
          className="mt-1.5 h-11 w-full rounded-[10px] border border-border bg-bg px-3 text-[16px] outline-none transition-colors focus:border-accent"
        />
        {state.error && (
          <p id="passcode-error" role="alert" className="mt-2 text-[13px] text-danger">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-5 h-11 w-full rounded-[10px] bg-fg text-[14px] font-semibold text-bg transition-[opacity,scale] duration-150 active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "בודק…" : "כניסה"}
        </button>
      </form>
    </main>
  );
}
