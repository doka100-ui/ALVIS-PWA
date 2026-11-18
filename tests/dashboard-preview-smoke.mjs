import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const previewUrl = process.env.ALVIS_PREVIEW_URL;
assert.ok(previewUrl, "ALVIS_PREVIEW_URL must point to this commit's Cloudflare Pages preview");
const expectedPages = ["chatPage", "candidatePage", "memoryPage", "historyPage", "syncPage"];

async function waitForDashboardImage(page) {
  await page.waitForFunction(() => {
    const image = document.querySelector(".alvis-reference-image");
    return !!image && image.complete && image.naturalWidth === 700 && image.naturalHeight === 564;
  }, null, { timeout: 60000 });
}

async function verifyBrowser(browserType, verifyOffline) {
  const browserName = browserType.name();
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    serviceWorkers: "allow",
    viewport: { width: 1440, height: 1200 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const pageErrors = [];
  const imageResponses = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.url().includes("/assets/alvis-dashboard-reference.avif")) {
      imageResponses.push({
        status: response.status(),
        fromServiceWorker: response.fromServiceWorker()
      });
    }
  });

  try {
    let releaseAppCss;
    const appCssGate = new Promise(resolve => { releaseAppCss = resolve; });
    let appCssRequested = false;
    await page.route("**/assets/alvis-app.css", async route => {
      appCssRequested = true;
      await appCssGate;
      await route.continue();
    });
    const response = await page.goto(previewUrl, {
      waitUntil: "commit",
      timeout: 120000
    });
    assert.ok(response && response.ok(), browserName + ": preview document must return HTTP 200");
    await page.waitForSelector("#lockPanel", { state: "visible", timeout: 15000 });
    const loginGate = await page.evaluate(() => ({
      loginVisible: !document.getElementById("lockPanel").classList.contains("hidden"),
      appHidden: document.getElementById("appPanel").classList.contains("hidden")
    }));
    assert.deepEqual(loginGate, { loginVisible: true, appHidden: true }, browserName + ": the real password gate must remain intact before app CSS finishes");
    const loginCss = await page.locator("style").first().textContent();
    assert.ok(loginCss.length < 12000, browserName + ": critical login CSS must remain small");
    assert.ok(appCssRequested, browserName + ": deferred app CSS request must be observed");
    assert.equal(await page.locator('link[href*="alvis-app.css"]').count(), 1, browserName + ": app CSS preload must exist");
    releaseAppCss();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(() => {
      const link = document.querySelector('link[href*="alvis-app.css"]');
      return !!link && link.rel === "stylesheet" && !!link.sheet;
    }, null, { timeout: 15000 });
    const refreshResponse = await page.request.get(new URL("refresh-v291.html", previewUrl).href);
    assert.ok(refreshResponse.ok(), browserName + ": v291 Service Worker refresh page must return HTTP 200");
    const refreshHtml = await refreshResponse.text();
    assert.ok(refreshHtml.includes('register("./service-worker.js",{updateViaCache:"none"})'), browserName + ": refresh page must reapply the no-cache update policy to existing registrations");
    assert.ok(refreshHtml.includes("registration.update()"), browserName + ": refresh page must explicitly request a Service Worker update");
    assert.ok(refreshHtml.includes("alvis-cache-v291-integrated"), browserName + ": refresh page must verify the v291 worker before redirecting");
    assert.ok(refreshHtml.includes("index-integrated.html?refresh=291"), browserName + ": refresh page must return to the integrated app only after v291 activation");

    const deferredImageState = await page.locator(".alvis-reference-image").evaluate(image => ({
      loading: image.loading,
      fetchPriority: image.fetchPriority
    }));
    assert.deepEqual(deferredImageState, { loading: "lazy", fetchPriority: "low" },
      browserName + ": hidden dashboard artwork must not compete with the initial login screen");

    // Reveal only the already-rendered app shell in this disposable test browser.
    // No password is submitted and no encrypted user data is read or changed.
    await page.evaluate(() => {
      const lockPanel = document.getElementById("lockPanel");
      const appPanel = document.getElementById("appPanel");
      lockPanel.classList.add("hidden");
      lockPanel.classList.remove("auth-exit");
      appPanel.classList.remove("hidden", "auth-enter");
      document.body.classList.remove("auth-transitioning");
    });
    await page.waitForFunction(() => {
      const chat = document.getElementById("chatPage");
      return !!chat && !chat.classList.contains("hidden");
    });
    await waitForDashboardImage(page);
    const imageState = await page.evaluate(() => {
      const image = document.querySelector(".alvis-reference-image");
      return {
        src: image.currentSrc,
        width: image.naturalWidth,
        height: image.naturalHeight
      };
    });
    assert.ok(imageState.src.includes("/assets/alvis-dashboard-reference.avif"), browserName + ": the approved AVIF must be requested after unlock");
    assert.equal(imageState.width, 700, browserName + ": approved artwork width");
    assert.equal(imageState.height, 564, browserName + ": approved artwork height");
    assert.ok(imageResponses.some(item => item.status === 200), browserName + ": approved artwork request must return HTTP 200 after unlock");

    const layout = await page.evaluate(() => {
      const stage = document.querySelector(".mode-stage.jarvis-stage");
      const image = document.querySelector(".alvis-reference-image");
      const rect = stage.getBoundingClientRect();
      return {
        imageDisplay: getComputedStyle(image).display,
        objectFit: getComputedStyle(image).objectFit,
        ratio: rect.width / rect.height,
        legacyCenterDisplay: getComputedStyle(stage.querySelector(".hud-center")).display,
        imageOpacity: getComputedStyle(image).opacity,
        stageOpacity: getComputedStyle(stage).opacity,
        sidePseudoContent: [".hud-side-left", ".hud-side-right"].flatMap(selector => {
          const side = stage.querySelector(selector);
          return ["::before", "::after"].map(pseudo => getComputedStyle(side, pseudo).content);
        }),
        ancestorOpacity: (() => {
          const values = [];
          for (let node = stage; node; node = node.parentElement) {
            values.push({ id: node.id, className: typeof node.className === "string" ? node.className : "", opacity: getComputedStyle(node).opacity });
          }
          return values;
        })(),
        artworkSamples: (() => {
          const canvas = document.createElement("canvas");
          canvas.width = 700; canvas.height = 564;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(image, 0, 0, 700, 564);
          return [[350,280],[350,480]].map(([x,y]) => Array.from(context.getImageData(x,y,1,1).data));
        })()
      };
    });
    assert.equal(layout.imageDisplay, "block", browserName + ": the approved image must be visible in ALVIS mode");
    assert.equal(layout.objectFit, "fill", browserName + ": the complete artwork must not be cropped");
    assert.ok(Math.abs(layout.ratio - 700 / 564) < 0.01, browserName + ": stage ratio must match the image");
    assert.equal(layout.legacyCenterDisplay, "none", browserName + ": legacy globe/rings must not be drawn over the artwork");
    assert.equal(layout.imageOpacity, "1", browserName + ": approved artwork must remain at full opacity");
    assert.equal(layout.stageOpacity, "1", browserName + ": image stage must remain at full opacity");
    assert.ok(layout.sidePseudoContent.every(value => value === "none"), browserName + ": legacy side glass/chart pseudo-elements must not cover the artwork");
    assert.ok(layout.ancestorOpacity.every(item => item.opacity === "1"), browserName + ": the unlocked workspace and artwork must not remain dimmed by a transition");
    assert.ok(layout.artworkSamples.every(pixel => pixel[0] + pixel[1] + pixel[2] > 420), browserName + ": the approved artwork must retain its original luminous colors");

    const menuCount = await page.locator(".hud-side-left .hud-nav button[data-page]").count();
    assert.equal(menuCount, 5, browserName + ": all five image-aligned menu hit areas must exist");
    const returnToChat = async () => {
      await page.evaluate(() => document.querySelector('#appPanel > nav button[data-page="chatPage"]').click());
      await page.waitForFunction(() => {
        const target = document.getElementById("chatPage");
        return !!target && !target.classList.contains("hidden");
      });
    };

    for (const pageId of expectedPages) {
      await returnToChat();
      await page.locator('.hud-side-left .hud-nav button[data-page="' + pageId + '"]').click();
      await page.waitForFunction(id => {
        const target = document.getElementById(id);
        return !!target && !target.classList.contains("hidden");
      }, pageId, { timeout: 15000 });
    }

    await returnToChat();
    await page.locator('.hud-side-right .hud-info-action[data-hud-action="memory"]').click();
    await page.waitForFunction(() => {
      const target = document.getElementById("memoryPage");
      return !!target && !target.classList.contains("hidden");
    });
    await returnToChat();
    await page.locator('.hud-side-right .hud-info-action[data-hud-action="growth"]').click();
    await page.waitForFunction(() => {
      const target = document.getElementById("growthPage");
      return !!target && !target.classList.contains("hidden");
    });

    await returnToChat();
    await page.waitForFunction(() => {
      const chat = document.getElementById("chatPage");
      return !!chat && !chat.classList.contains("alvis-page-enter") &&
        !document.body.classList.contains("alvis-page-transitioning");
    }, null, { timeout: 10000 });
    const finalDisplayState = await page.evaluate(() => ({
      chatOpacity: getComputedStyle(document.getElementById("chatPage")).opacity,
      imageOpacity: getComputedStyle(document.querySelector(".alvis-reference-image")).opacity
    }));
    assert.equal(finalDisplayState.chatOpacity, "1", browserName + ": page transition must finish before the preview screenshot");
    assert.equal(finalDisplayState.imageOpacity, "1", browserName + ": artwork must remain fully opaque after navigation");
    const aiHitArea = await page.locator("#hudAiAction").evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        pointerEvents: getComputedStyle(element).pointerEvents
      };
    });
    assert.ok(aiHitArea.width > 0 && aiHitArea.height > 0, browserName + ": local AI hit area must have a real size");
    assert.equal(aiHitArea.pointerEvents, "auto", browserName + ": local AI hit area must accept taps");
    assert.equal(await page.locator("#chatInput").isVisible(), true, browserName + ": chat composer must remain available");
    assert.equal(await page.locator("#sendChat").count(), 1, browserName + ": existing send control must remain in the DOM");

    await mkdir("artifacts", { recursive: true });
    if (browserName === "chromium") {
      await page.screenshot({ path: "artifacts/alvis-dashboard-preview.png", fullPage: true });
    }

    if (verifyOffline) {
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      let controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
      if (!controlled) {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
        await page.evaluate(() => {
          document.getElementById("lockPanel")?.classList.add("hidden");
          document.getElementById("appPanel")?.classList.remove("hidden");
        });
        await waitForDashboardImage(page);
        controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
      }
      assert.equal(controlled, true, "Chromium: app shell must be controlled by the Service Worker");

      // Repeat the exact launch path to catch the reported 2nd/3rd-open slowdown.
      for (let launch = 2; launch <= 3; launch++) {
        const startedAt = Date.now();
        const repeatedResponse = await page.reload({ waitUntil: "commit", timeout: 15000 });
        const elapsedMs = Date.now() - startedAt;
        assert.ok(repeatedResponse && repeatedResponse.ok(), "Chromium: repeat launch " + launch + " must return HTTP 200");
        assert.equal(repeatedResponse.fromServiceWorker(), true, "Chromium: repeat launch " + launch + " must use the Service Worker");
        assert.ok(elapsedMs < 3000, "Chromium: repeat launch " + launch + " must not wait on a network-first shell request (" + elapsedMs + "ms)");
        await page.waitForSelector("#lockPanel", { state: "visible", timeout: 5000 });
      }

      const cacheInfo = await page.evaluate(async () => {
        const names = await caches.keys();
        for (const name of names.filter(value => value.startsWith("alvis-cache-"))) {
          const cache = await caches.open(name);
          const cached = await cache.match(new URL("./assets/alvis-dashboard-reference.avif", location.href).href);
          if (cached) return { name, status: cached.status };
        }
        return null;
      });
      assert.ok(cacheInfo && cacheInfo.status === 200, "Chromium: approved artwork must be in the app-shell cache");

      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      const offlineImageResponsePromise = page.waitForResponse(
        response => response.url().includes("/assets/alvis-dashboard-reference.avif"),
        { timeout: 45000 }
      );
      await context.setOffline(true);
      const offlineNavigation = await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      assert.ok(offlineNavigation && offlineNavigation.ok(), "Chromium: integrated app shell must reload offline");
      await page.evaluate(() => {
        document.getElementById("lockPanel")?.classList.add("hidden");
        document.getElementById("appPanel")?.classList.remove("hidden");
      });
      const offlineImageResponse = await offlineImageResponsePromise;
      assert.equal(offlineImageResponse.status(), 200, "Chromium: dashboard image must load offline");
      assert.equal(offlineImageResponse.fromServiceWorker(), true, "Chromium: offline image must come from the Service Worker cache");
      await waitForDashboardImage(page);
      const offlineProbe = await page.evaluate(async () => {
        const response = await fetch("./__alvis_offline_probe__?nonce=" + Date.now(), { cache: "no-store" });
        return { status: response.status, body: await response.text() };
      });
      assert.equal(offlineProbe.status, 503, "Chromium: an uncached request must use the Service Worker offline fallback");
      assert.match(offlineProbe.body, /ALVIS: オフライン/, "Chromium: the offline fallback response must be served");
    }

    console.log("PASS " + browserName + ": deployed image, no-crop layout, menu navigation, memory/growth actions, AI hit area, and chat composer");
    if (verifyOffline) console.log("PASS Chromium: Service Worker precache and offline reload");
    if (pageErrors.length) console.log(browserName + " page errors observed: " + JSON.stringify(pageErrors));
  } finally {
    await browser.close();
  }
}


async function verifyMobileWebKit() {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1"
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  try {
    const navigationStartedAt = Date.now();
    const response = await page.goto(previewUrl, {
      waitUntil: "commit",
      timeout: 120000
    });
    assert.ok(response && response.ok(), "iPhone WebKit: preview document must return HTTP 200");
    await page.waitForSelector("#lockPanel", { state: "visible", timeout: 15000 });
    const launchTiming = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const paints = performance.getEntriesByType("paint");
      const paintTime = name => paints.find(entry => entry.name === name)?.startTime ?? null;
      return {
        loginVisibleMs: performance.now(),
        responseStartMs: navigation?.responseStart ?? null,
        domInteractiveMs: navigation?.domInteractive ?? null,
        domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
        loadEventEndMs: navigation?.loadEventEnd || null,
        firstPaintMs: paintTime("first-paint"),
        firstContentfulPaintMs: paintTime("first-contentful-paint")
      };
    });
    console.log("TIMING iPhone WebKit: " + JSON.stringify({
      wallClockToLoginMs: Date.now() - navigationStartedAt,
      ...launchTiming
    }));
    const initialState = await page.evaluate(() => {
      const lock = document.getElementById("lockPanel");
      const app = document.getElementById("appPanel");
      const image = document.querySelector(".alvis-reference-image");
      const rect = lock?.getBoundingClientRect();
      return {
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 500) || "",
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        lockExists: !!lock,
        lockVisible: !!lock && !lock.classList.contains("hidden") && getComputedStyle(lock).display !== "none",
        lockWidth: rect?.width || 0,
        appHidden: !!app && app.classList.contains("hidden"),
        imageLazy: !!image && image.loading === "lazy",
        imagePriority: image?.fetchPriority || "",
        imageLoaded: !!image && image.complete && image.naturalWidth === 700
      };
    });
    assert.ok(initialState.lockVisible && initialState.lockWidth > 0,
      "iPhone WebKit: initial password screen must be visible; state=" + JSON.stringify(initialState));
    assert.equal(initialState.appHidden, true, "iPhone WebKit: app panel must remain locked initially");
    assert.equal(initialState.imageLazy, true, "iPhone WebKit: hidden ALVIS artwork must be deferred");
    assert.equal(initialState.imagePriority, "low", "iPhone WebKit: hidden ALVIS artwork must not have high fetch priority");
    assert.deepEqual(pageErrors, [], "iPhone WebKit: no uncaught JavaScript errors; console=" + JSON.stringify(consoleErrors));
    await page.screenshot({ path: "artifacts/alvis-dashboard-iphone-webkit.png", fullPage: true });
    await page.evaluate(() => {
      document.getElementById("lockPanel")?.classList.add("hidden");
      document.getElementById("appPanel")?.classList.remove("hidden");
    });
    await waitForDashboardImage(page);
    const imageLoadedAfterUnlock = await page.locator(".alvis-reference-image").evaluate(image => image.complete && image.naturalWidth === 700);
    assert.equal(imageLoadedAfterUnlock, true, "iPhone WebKit: approved ALVIS artwork must load after the app is revealed");
    console.log("PASS iPhone WebKit: initial password screen and ALVIS artwork render without uncaught errors");
    if (consoleErrors.length) console.log("iPhone WebKit console errors: " + JSON.stringify(consoleErrors));
  } finally {
    await browser.close();
  }
}

await verifyBrowser(chromium, true);
await verifyBrowser(webkit, false);
await verifyMobileWebKit();
console.log("All deployed dashboard browser smoke checks passed.");