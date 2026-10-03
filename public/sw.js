/* global self, clients */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* Show a fallback for malformed payloads. */ }
  event.waitUntil(self.registration.showNotification(data.title || "liberoBot", {
    body: data.body || "עדכון חדש ממתין בדשבורד",
    icon: "/icon-192.png",
    dir: "rtl",
    lang: "he",
    tag: data.tag || "libero-update",
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((window) => new URL(window.url).origin === self.location.origin);
    if (existing) { await existing.navigate("/"); return existing.focus(); }
    return clients.openWindow("/");
  })());
});
