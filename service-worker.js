const CACHE_NAME = "alvis-cache-v99-integrated";
const DEPENDENCY_CACHE_NAME = "alvis-deps-v2";
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
    // module import / Worker / WASM fetches may have an empty destination.
    // Cache successful assets from explicitly trusted CDNs, including Kokoro's
    // Japanese dictionary, Worker and WASM files.
    const isTrustedDependency = DEPENDENCY_ORIGINS.has(url.origin);

    try {
      const response = await fetch(request);
      // 許可したCDNの依存コード/音声用アセットを専用キャッシュへ保存する。
      // Hugging Face上の大容量モデルは各推論ライブラリのモデルキャッシュに任せる。
      if (isTrustedDependency && response.ok && response.type !== "opaque" && request.headers.get("range") === null) {
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
