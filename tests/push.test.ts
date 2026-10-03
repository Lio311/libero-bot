import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import webpush from "web-push";
import { NextRequest } from "next/server";
import { deliverPush, expiredPush, validPushEndpoint, validPushKeys } from "../src/lib/push";
import { GET, POST } from "../src/app/api/push/route";
import { SESSION_COOKIE, sessionToken } from "../src/lib/passcode";

const endpoint = "https://fcm.googleapis.com/fcm/send/example";

test("accepts browser push providers and rejects arbitrary destinations", () => {
  for (const url of [endpoint, "https://updates.push.services.mozilla.com/wpush/v2/example", "https://web.push.apple.com/example", "https://a.push.apple.com/example"]) assert.equal(validPushEndpoint(url), true);
  for (const url of ["http://fcm.googleapis.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://fcm.googleapis.com.attacker.example/x", "https://push.apple.com.attacker.example/x", "https://user:password@fcm.googleapis.com/x", "https://fcm.googleapis.com:444/x", "not a url"]) assert.equal(validPushEndpoint(url), false);
});

test("validates browser encryption keys", () => {
  const keys = { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString("base64url"), auth: Buffer.alloc(16).toString("base64url") };
  assert.equal(validPushKeys(keys), true);
  assert.equal(validPushKeys({ ...keys, auth: "short" }), false);
  assert.equal(validPushKeys({ ...keys, p256dh: Buffer.alloc(65).toString("base64url") }), false);
  assert.equal(validPushKeys(null), false);
  assert.equal(expiredPush({ statusCode: 410 }), true);
  assert.equal(expiredPush({ statusCode: 404 }), true);
  assert.equal(expiredPush({ statusCode: 503 }), false);
});

test("push API requires a session and rejects cross-origin mutations", async () => {
  const previous = { passcode: process.env.DASHBOARD_PASSCODE, secret: process.env.AUTH_SECRET };
  process.env.DASHBOARD_PASSCODE = "test-passcode";
  process.env.AUTH_SECRET = "test-secret";
  try {
    assert.equal(GET(new NextRequest("https://libero.example/api/push")).status, 401);
    const cookie = `${SESSION_COOKIE}=${sessionToken()}`;
    assert.equal((await POST(new NextRequest("https://libero.example/api/push", { method: "POST", headers: { cookie, origin: "https://other.example" }, body: "{}" }))).status, 403);
    assert.equal((await POST(new NextRequest("https://libero.example/api/push", { method: "POST", headers: { cookie, origin: "https://libero.example" }, body: "not json" }))).status, 400);
    assert.equal((await POST(new NextRequest("https://libero.example/api/push", { method: "POST", headers: { cookie, origin: "https://libero.example" }, body: JSON.stringify({ endpoint: "https://127.0.0.1/", action: "subscribe" }) }))).status, 400);
  } finally {
    for (const [key, value] of [["DASHBOARD_PASSCODE", previous.passcode], ["AUTH_SECRET", previous.secret]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
  }
});

test("passes notification payload, VAPID and bounded TTL/timeout to the sender", async () => {
  const keys = webpush.generateVAPIDKeys();
  const names = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
  const previous = names.map((name) => process.env[name]);
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
  const original = webpush.sendNotification;
  let called = false;
  webpush.sendNotification = async (subscription, payload, options) => {
    called = true;
    assert.equal(subscription.endpoint, endpoint);
    assert.equal(JSON.parse(String(payload)).body, "סיכום הבוקר");
    assert.equal(options?.TTL, 21600);
    assert.equal(options?.timeout, 10000);
    assert.equal(options?.vapidDetails?.publicKey, keys.publicKey);
    return { statusCode: 201, body: "", headers: {} };
  };
  try {
    await deliverPush({ endpoint, p256dh: "key", auth: "auth" }, { title: "liberoBot", body: "סיכום הבוקר", tag: "daily" });
    assert.equal(called, true);
    await assert.rejects(deliverPush({ endpoint: "https://127.0.0.1", p256dh: "key", auth: "auth" }, { title: "", body: "", tag: "" }));
  } finally {
    webpush.sendNotification = original;
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
  }
});

test("worker shows Hebrew notifications, falls back for malformed data, opens same-origin dashboard", async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const notifications: { title: string; options: { body: string; dir: string } }[] = [];
  const opened: string[] = [];
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    URL,
    self: { addEventListener: (name: string, callback: (event: unknown) => void) => { handlers[name] = callback; }, location: { origin: "https://libero.example" }, registration: { showNotification: async (title: string, options: { body: string; dir: string }) => { notifications.push({ title, options }); } } },
    clients: { matchAll: async () => [], openWindow: async (path: string) => { opened.push(path); } },
  });
  let completion: Promise<unknown> = Promise.resolve();
  const waitUntil = (promise: Promise<unknown>) => { completion = promise; };
  handlers.push({ data: { json: () => ({ title: "סיכום", body: "עדכון" }) }, waitUntil });
  await completion;
  assert.equal(notifications[0].title, "סיכום");
  assert.equal(notifications[0].options.dir, "rtl");
  handlers.push({ data: { json: () => { throw new Error("malformed"); } }, waitUntil });
  await completion;
  assert.equal(notifications[1].title, "liberoBot");
  let closed = false;
  handlers.notificationclick({ notification: { close: () => { closed = true; } }, waitUntil });
  await completion;
  assert.equal(closed, true);
  assert.deepEqual(opened, ["/"]);
});
