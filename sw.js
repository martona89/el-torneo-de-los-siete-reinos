const IMAGE_CACHE = "torneo-public-images-v1";
const MAX_CACHED_IMAGES = 250;

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("torneo-public-images-") && key !== IMAGE_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.destination !== "image") return;

  const url = new URL(request.url);
  const isPublicSupabaseImage = url.hostname.endsWith(".supabase.co") &&
    (url.pathname.includes("/storage/v1/object/public/") || url.pathname.includes("/storage/v1/render/image/public/"));
  if (!isPublicSupabaseImage) return;

  event.respondWith((async () => {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.startsWith("image/")) {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > MAX_CACHED_IMAGES) {
        await cache.delete(keys[0]);
      }
    }
    return response;
  })().catch(async () => {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response("Imagen no disponible sin conexión", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8"}});
  }));
});
