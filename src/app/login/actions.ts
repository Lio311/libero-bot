"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { passcodeOk, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/passcode";

export async function login(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const passcode = form.get("passcode");
  if (!passcodeOk(passcode)) {
    // Slows down guessing without locking the owner out.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "קוד שגוי" };
  }
  const token = sessionToken();
  if (token)
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  const next = String(form.get("next") ?? "/");
  // Only same-site paths, never an open redirect.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
