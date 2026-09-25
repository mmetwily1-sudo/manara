/* Manara service worker — Web Push فقط (لا كاش عدواني) */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "منارة";
  const body = data.body || "";
  const url = data.url || "/progress";
  event.waitUntil(
    self.registration.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url }, dir: "rtl", lang: "ar" })
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/progress";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) { c.focus(); if (c.navigate) return c.navigate(url); return; } }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
self.addEventListener("pushsubscriptionchange", async (event) => {
  // المتصفح حدّث الاشتراك — أعد التسجيل (توصية اللجنة)
  try {
    const reg = await self.registration.pushManager.getSubscription();
    if (!reg) return;
    const res = await fetch("/api/push/subscribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: reg.toJSON() }),
    }).catch(() => null);
    void res;
  } catch {}
  void event;
});
