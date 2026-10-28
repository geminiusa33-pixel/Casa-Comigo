self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    data: {
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
    },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { resourceType, resourceId } = event.notification.data ?? {};
  const url = new URL("/", self.location.origin);
  if (resourceType && resourceId) {
    url.searchParams.set("openType", resourceType);
    url.searchParams.set("openId", resourceId);
  }
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(url.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(url.href);
  })());
});
