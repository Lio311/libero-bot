import { readFile } from "node:fs/promises";

// Local preview of the 08:00 email: run `npx tsx scraper/digest.ts --force --dry`, then open /dev/email.
// Not available in production.
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  try {
    return new Response(await readFile("digest-preview.html", "utf8"), { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return new Response("Run: npx tsx scraper/digest.ts --force --dry", { status: 404 });
  }
}
