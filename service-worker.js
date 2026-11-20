const CACHE_NAME = "alvis-cache-v292-integrated";
// v251: keep the integrated PWA launch path available after the first online visit.
const DEPENDENCY_CACHE_NAME = "alvis-deps-v2";
const DEPENDENCY_ORIGINS = new Set([
  "https://esm.run",
  "https://cdn.jsdelivr.net",
  "https://ajax.googleapis.com"
]);

// Only the login-critical shell is required before a new worker can activate.
// Large images and Avatar-only assets are cached on demand after the page opens.
const REQUIRED_FILES_TO_CACHE = [
  "./index-integrated.html",
  "./assets/alvis-app.css"
];

self.addEventListener("message", (event) => {
  if (event.data?.type !== "ALVIS_GET_BUILD_INFO") return;
  const reply = event.ports?.[0];
  if (reply) reply.postMessage({ cacheName: CACHE_NAME });
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache only the integrated login shell and its critical stylesheet before
    // activation. Do not make login availability wait for dashboard/Avatar images.
    await Promise.all(REQUIRED_FILES_TO_CACHE.map(async (file) => {
      const request = new Request(file, { cache: "reload" });
      const response = await fetch(request);
      if (!response.ok || response.type === "opaque") {
        throw new Error("Required ALVIS shell asset unavailable: " + file + " (" + response.status + ")");
      }
      await cache.put(request, response);
    }));
    const shell = await cache.match("./index-integrated.html");
    if (!shell) throw new Error("Required ALVIS integrated shell could not be cached");
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        // ALVIS自身の旧アプリ/依存コードキャッシュだけを更新する。
        // WebLLMのモデルキャッシュなど、他ライブラリのCache Storageは保持する。
        .filter((key) =>
          (key.startsWith("alvis-cache-") && key !== CACHE_NAME) ||
          (key.startsWith("alvis-deps-") && key !== DEPENDENCY_CACHE_NAME)
        )
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

// iOS Safari can reject a redirected Response returned by a Service Worker.
// Strip redirect metadata while preserving the final response body and headers.
function makeServiceWorkerSafeResponse(response) {
  if (!response || !response.redirected || response.type === "opaque" || response.status === 0) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith((async () => {
    const url = new URL(request.url);
    const isIntegratedShellNavigation =
      request.mode === "navigate" &&
      url.origin === self.location.origin &&
      /\/index-integrated\.html$/.test(url.pathname);

    const appCache = await caches.open(CACHE_NAME);

    // v284: serve the verified app shell immediately on repeat visits.
    // The page registers/updates this versioned worker after first paint, and
    // the install step precaches each new deployed shell before skipWaiting.
    if (isIntegratedShellNavigation) {
      const cachedShell = await appCache.match("./index-integrated.html");
      if (cachedShell) return makeServiceWorkerSafeResponse(cachedShell);
      try {
        const response = makeServiceWorkerSafeResponse(await fetch(request));
        if (response.ok && response.type !== "opaque") {
          const shellUrl = new URL("./index-integrated.html", self.registration.scope).href;
          try { await appCache.put(shellUrl, response.clone()); } catch (cacheError) {}
          return response;
        }
        return response;
      } catch (networkError) {
        const fallback = await appCache.match("./index.html");
        if (fallback) return makeServiceWorkerSafeResponse(fallback);
      }
    }

    // Search only ALVIS-owned caches for normal app assets. CacheStorage.match()
    // scans every origin cache, including the many large WebLLM model entries.
    const cachedAppAsset = await appCache.match(request, { ignoreSearch: true });
    if (cachedAppAsset) return makeServiceWorkerSafeResponse(cachedAppAsset);
    const dependencyCache = await caches.open(DEPENDENCY_CACHE_NAME);
    const cachedDependency = await dependencyCache.match(request, { ignoreSearch: true });
    if (cachedDependency) return makeServiceWorkerSafeResponse(cachedDependency);

    // Preserve the library-managed offline model cache without scanning every
    // CacheStorage namespace for every ALVIS page, CSS, image, or script request.
    if (url.origin !== self.location.origin) {
      for (const cacheName of ["webllm/model", "webllm/config", "webllm/wasm"]) {
        const libraryCache = await caches.open(cacheName);
        const cachedLibraryAsset = await libraryCache.match(request, { ignoreSearch: true });
        if (cachedLibraryAsset) return makeServiceWorkerSafeResponse(cachedLibraryAsset);
      }
    }

    // module import / Worker / WASM fetches may have an empty destination.
    // Cache successful assets from explicitly trusted CDNs, including Kokoro's
    // Japanese dictionary, Worker and WASM files.
    const isTrustedDependency = DEPENDENCY_ORIGINS.has(url.origin);

    try {
      const response = makeServiceWorkerSafeResponse(await fetch(request));
      // Cache same-origin app assets after they are actually requested. This keeps
      // Avatar-only assets and dashboard artwork available offline without delaying
      // the login-critical Service Worker install.
      if (url.origin === self.location.origin && !url.pathname.includes("/sync/") &&
          response.ok && response.type !== "opaque" && request.headers.get("range") === null) {
        const cache = await caches.open(CACHE_NAME);
        const cacheRequest = request.mode === "navigate" && /\/index-integrated\.html$/.test(url.pathname)
          ? new Request(new URL("./index-integrated.html", self.registration.scope).href)
          : request;
        try { await cache.put(cacheRequest, response.clone()); } catch (cacheError) {}
      }
      // Trusted CDN dependencies are cached separately; large Hugging Face models
      // remain managed by WebLLM/Kokoro and are never touched here.
      if (isTrustedDependency && response.ok && response.type !== "opaque" && request.headers.get("range") === null) {
        const cache = await caches.open(DEPENDENCY_CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      // オフライン時にHTMLをJavaScript/WASM等の代わりに返さない。
      if (request.mode === "navigate") {
        const appShell =
          await appCache.match("./index-integrated.html") ||
          await appCache.match("./index.html");
        if (appShell) return makeServiceWorkerSafeResponse(appShell);
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
