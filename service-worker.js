const CACHE_NAME = "alvis-cache-v19-integrated";
const DEPENDENCY_CACHE_NAME = "alvis-deps-v1";
const DEPENDENCY_ORIGINS = new Set([
  "https://esm.run",
  "https://cdn.jsdelivr.net"
]);

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./index-integrated.html",
  "./manifest.json",
  "./manifest-integrated.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          // ALVIS自身の旧アプリ/依存コードキャッシュだけを更新する。
          // WebLLMのモデルキャッシュなど、他ライブラリのCache Storageは保持する。
          .filter((key) =>
            (key.startsWith("alvis-cache-") && key !== CACHE_NAME) ||
            (key.startsWith("alvis-deps-") && key !== DEPENDENCY_CACHE_NAME)
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const url = new URL(request.url);
    const isTrustedModule =
      request.destination === "script" &&
      DEPENDENCY_ORIGINS.has(url.origin);

    try {
      const response = await fetch(request);
      // WebLLMのES module依存コードのみを別キャッシュへ保存する。
      // 大容量モデル資材はWebLLM自身のCache API管理に任せる。
      if (isTrustedModule && response.ok && response.type !== "opaque") {
        const cache = await caches.open(DEPENDENCY_CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      // オフライン時にHTMLをJavaScript/WASM等の代わりに返さない。
      if (request.mode === "navigate") {
        const appShell =
          await caches.match("./index-integrated.html") ||
          await caches.match("./index.html");
        if (appShell) return appShell;
      }
      return new Response(
        "ALVIS: オフラインのため、このファイルを取得できません。オンラインで一度読み込んでください。",
        {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store"
          }
        }
      );
    }
  })());
});
