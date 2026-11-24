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
  await page.addInitScript(() => {
    window.__alvisWindowErrors = [];
    window.addEventListener("error", event => {
      window.__alvisWindowErrors.push({
        message: event.message || "",
        filename: event.filename || "",
        lineno: event.lineno || 0,
        colno: event.colno || 0,
        stack: event.error?.stack || ""
      });
    });
    window.addEventListener("unhandledrejection", event => {
      window.__alvisWindowErrors.push({
        message: String(event.reason?.message || event.reason || "unhandled rejection"),
        stack: event.reason?.stack || ""
      });
    });
  });
  const pageErrors = [];
  const consoleErrors = [];
  const imageResponses = [];
  page.on("pageerror", error => pageErrors.push({ name: error.name || "", message: error.message, stack: error.stack || "" }));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
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

    // Reproduce a fast unlock while the deferred ALVIS stylesheet is still held.
    // The first motion attempt must safely wait for the real HUD CSS to apply.
    await page.evaluate(() => {
      document.getElementById("appPanel").classList.remove("hidden");
      window.startAlvisHudMotion?.();
    });
    const preStylesheetMotion = await page.locator(".hud-orbit-a").evaluate(node => node.getAnimations().length);
    assert.equal(preStylesheetMotion, 0, browserName + ": HUD motion must not start against the unstyled reference image");

    releaseAppCss();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(() => {
      const link = document.querySelector('link[href*="alvis-app.css"]');
      return !!link && link.rel === "stylesheet" && !!link.sheet;
    }, null, { timeout: 15000 });
    try {
      await page.waitForFunction(() => {
        const chat = document.getElementById("chatPage");
        const image = document.querySelector(".jarvis-stage .alvis-reference-image");
        return chat?.dataset.displayMode === "jarvis" && !!image
          && getComputedStyle(image).display === "none";
      }, null, { timeout: 15000 });
    } catch (error) {
      const state = await page.evaluate(() => {
        const chat = document.getElementById("chatPage");
        const image = document.querySelector(".jarvis-stage .alvis-reference-image");
        const appCss = document.querySelector('link[href*="alvis-app.css"]');
        return {
          chatExists: !!chat,
          chatHidden: chat?.classList.contains("hidden"),
          displayMode: chat?.dataset.displayMode || null,
          imageExists: !!image,
          imageDisplay: image ? getComputedStyle(image).display : null,
          appCssRel: appCss?.rel || null,
          appCssLoaded: !!appCss?.sheet,
          lockHidden: document.getElementById("lockPanel")?.classList.contains("hidden"),
          appHidden: document.getElementById("appPanel")?.classList.contains("hidden")
        };
      });
      const windowErrors = await page.evaluate(() => window.__alvisWindowErrors || []);
      throw new Error(browserName + ": live HUD did not initialize: " + JSON.stringify({state,pageErrors,consoleErrors,windowErrors,error:error.message}));
    }
    await page.waitForFunction(() => {
      const ring = document.querySelector(".jarvis-stage .hud-orbit-a");
      return !!ring && ring.getAnimations().length > 0;
    }, null, { timeout: 10000 });
    const outerRingMotion = await page.locator(".jarvis-stage .hud-orbit-c").evaluate(node => ({
      animations: node.getAnimations().map(animation => ({
        duration: animation.effect?.getTiming().duration,
        keyframes: animation.effect?.getKeyframes()
      })),
      top: getComputedStyle(node).top,
      right: getComputedStyle(node).right,
      bottom: getComputedStyle(node).bottom,
      left: getComputedStyle(node).left,
      margin: getComputedStyle(node).margin,
      translate: getComputedStyle(node).translate,
      transform: getComputedStyle(node).transform,
      parentWidth: node.parentElement.getBoundingClientRect().width,
      parentHeight: node.parentElement.getBoundingClientRect().height,
      topRatio: parseFloat(getComputedStyle(node).top) / node.parentElement.getBoundingClientRect().height,
      leftRatio: parseFloat(getComputedStyle(node).left) / node.parentElement.getBoundingClientRect().width,
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
      aspectRatio: getComputedStyle(node).aspectRatio,
      gearTickCount: node.querySelectorAll(".hud-gear-teeth .gear-tick").length,
      majorTickCount: node.querySelectorAll(".hud-gear-teeth .gear-tick-major").length,
      toothInset: getComputedStyle(node, "::before").inset,
      toothMask: getComputedStyle(node, "::before").maskImage
    }));
    assert.ok(outerRingMotion.animations.some(animation => {
      const angles = animation.keyframes.map(frame => {
        const direct = String(frame.rotate || "").match(/^(-?[\d.]+)deg$/);
        if (direct) return Number(direct[1]);
        const value = String(frame.transform || "");
        const match = value.match(/rotate\((-?[\d.]+)deg\)/);
        return match ? Number(match[1]) : NaN;
      }).filter(Number.isFinite);
      return (animation.duration === 22000 || animation.duration === 42000) && angles.length >= 2
        && Math.abs(Math.abs(angles[angles.length - 1] - angles[0]) - 360) < 0.1;
    }), browserName + ": outer ring C must complete one independent 360-degree rotation in 42 seconds: " + JSON.stringify(outerRingMotion.animations));
    assert.ok(Math.abs(outerRingMotion.topRatio - 0.42) < 0.01,
      browserName + ": outer ring C vertical anchor mismatch: ratio=" + outerRingMotion.topRatio + ", top=" + outerRingMotion.top + ", parentHeight=" + outerRingMotion.parentHeight);
    assert.ok(Math.abs(outerRingMotion.leftRatio - 0.5) < 0.01,
      browserName + ": outer ring C must share the globe core's 50% horizontal anchor");
    assert.equal(outerRingMotion.translate, "-50% -50%", browserName + ": outer ring C must center its own bounds on the globe anchor");
    assert.equal(outerRingMotion.transform, "none", browserName + ": outer ring C must not receive a second transform translate");
    assert.equal(outerRingMotion.aspectRatio, "1 / 1", browserName + ": outer ring C must use a square aspect-ratio box");
    assert.ok(Math.abs(outerRingMotion.width - outerRingMotion.height) < 1.5,
      browserName + ": outer ring C must render as a true circle rather than a flattened ellipse");
    assert.equal(outerRingMotion.gearTickCount, 48, browserName + ": outer rim must render 48 subtle index ticks");
    assert.equal(outerRingMotion.majorTickCount, 8, browserName + ": outer rim must render 8 longer clock-index ticks");
    const refreshResponse = await page.request.get(new URL("refresh.html", previewUrl).href);
    assert.ok(refreshResponse.ok(), browserName + ": canonical Service Worker refresh page must return HTTP 200");
    const refreshHtml = await refreshResponse.text();
    assert.ok(refreshHtml.includes('register("./service-worker.js",{updateViaCache:"none"})'), browserName + ": refresh page must reapply the no-cache update policy to existing registrations");
    assert.ok(refreshHtml.includes("registration.update()"), browserName + ": refresh page must explicitly request a Service Worker update");
    assert.ok(refreshHtml.includes("alvis-cache-v") && refreshHtml.includes("-integrated") && !refreshHtml.includes("alvis-cache-v347-integrated"), browserName + ": refresh page must verify a versioned integrated worker without a pinned legacy build number");
    assert.ok(refreshHtml.includes('const target="./index-integrated.html"'), browserName + ": refresh page must return to the canonical integrated app after activation");
    assert.ok((await page.locator("#generateDevelopmentHandoff").count())===1, browserName + ": development handoff generator must exist");
    assert.ok((await page.locator("#developmentHandoffOutput").count())===1, browserName + ": handoff output must exist");

    const deferredImageState = await page.locator(".alvis-reference-image").evaluate(image => ({
      loading: image.loading,
      fetchPriority: image.fetchPriority
    }));
    assert.deepEqual(deferredImageState, { loading: "lazy", fetchPriority: "low" },
      browserName + ": hidden dashboard artwork must not compete with the initial login screen");

    // Reveal the existing app shell in this disposable test browser.
    // No password is submitted and no encrypted user data is read or changed.
    await page.evaluate(() => {
      const lockPanel = document.getElementById("lockPanel");
      const appPanel = document.getElementById("appPanel");
      lockPanel.classList.add("hidden");
      lockPanel.classList.remove("auth-exit");
      appPanel.classList.remove("hidden", "auth-enter");
      document.body.classList.remove("auth-transitioning");
      window.startAlvisHudMotion?.(); // mirrors the real unlock() post-transition startup
    });
    await page.waitForFunction(() => {
      const chat = document.getElementById("chatPage");
      return !!chat && !chat.classList.contains("hidden") &&
        chat.dataset.displayMode === "jarvis";
    });
    await page.waitForFunction(() => {
      const ring = document.querySelector(".jarvis-stage .hud-orbit-a");
      return !!ring && ring.getAnimations().length > 0;
    }, null, { timeout: 10000 });
    const liveHud = await page.evaluate(() => {
      const stage = document.querySelector(".mode-stage.jarvis-stage");
      const image = stage.querySelector(".alvis-reference-image");
      const center = stage.querySelector(".hud-center");
      const globe = stage.querySelector(".hud-globe-map");
      const ringA = stage.querySelector(".hud-orbit-a");
      const ringB = stage.querySelector(".hud-orbit-b");
      const ringC = stage.querySelector(".hud-orbit-c");
      const point = element => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      };
      const coreCenter = point(stage.querySelector(".hud-core"));
      const ringCenters = [point(ringA), point(ringB), point(ringC)];
      return {
        stageDisplay: getComputedStyle(stage).display,
        imageDisplay: getComputedStyle(image).display,
        centerDisplay: getComputedStyle(center).display,
        globeDisplay: getComputedStyle(globe).display,
        globeWidth: globe.getBoundingClientRect().width,
        ringAAnimations: ringA.getAnimations().length,
        ringBAnimations: ringB.getAnimations().length,
        ringCenterOffsets: ringCenters.map(p => ({
          x: Math.round((p.x - coreCenter.x) * 10) / 10,
          y: Math.round((p.y - coreCenter.y) * 10) / 10
        }))
      };
    });
    assert.notEqual(liveHud.stageDisplay, "none", browserName + ": live ALVIS stage must be visible");
    assert.equal(liveHud.imageDisplay, "none", browserName + ": static reference image must not replace the live hologram");
    assert.notEqual(liveHud.centerDisplay, "none", browserName + ": live globe/ring center must be visible");
    assert.notEqual(liveHud.globeDisplay, "none", browserName + ": hologram globe SVG must be visible");
    assert.ok(liveHud.globeWidth > 80, browserName + ": hologram globe must have a real rendered size");
    assert.ok(liveHud.ringAAnimations > 0 && liveHud.ringBAnimations > 0,
      browserName + ": both orbital rings must be animated; state=" + JSON.stringify(liveHud));
    assert.ok(Math.abs(liveHud.ringCenterOffsets[2].x) < 3 && Math.abs(liveHud.ringCenterOffsets[2].y) < 3,
      browserName + ": the outer gear ring C must share the exact globe center; offsets=" + JSON.stringify(liveHud.ringCenterOffsets[2]));

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

    await page.locator('#appPanel > nav button[data-page="devicePage"]').click();
    await page.waitForFunction(() => !document.getElementById("devicePage").classList.contains("hidden"));
    await page.locator("#generateDevelopmentHandoff").waitFor({ state: "visible" });
    await page.locator("#generateDevelopmentHandoff").click();
    const generatedHandoff = await page.locator("#developmentHandoffOutput").inputValue();
    assert.ok(generatedHandoff.includes("# ALVIS 開発管制・引き継ぎ"),
      browserName + ": handoff generator must create the expected handoff document");
    assert.ok(generatedHandoff.includes("リポジトリ: https://github.com/doka100-ui/ALVIS-PWA")
      && generatedHandoff.includes("作業ブランチ: development"),
      browserName + ": handoff must include the project repository and branch");
    assert.ok(!/ALVIS_SYNC_TOKEN(?:_KEY)?\s*[:=]|password\s*[:=]\s*[^\s]+|記憶本文[:：]\s*[^\s]+|会話履歴の内容[:：]\s*[^\s]+/.test(generatedHandoff),
      browserName + ": handoff must not expose secrets or private user content");
    assert.equal(await page.locator("#copyDevelopmentHandoff").isEnabled(), true,
      browserName + ": copy button must be enabled after handoff generation");
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
      centerDisplay: getComputedStyle(document.querySelector(".hud-center")).display,
      ringAnimations: document.querySelector(".hud-orbit-a").getAnimations().length
    }));
    assert.equal(finalDisplayState.chatOpacity, "1", browserName + ": page transition must finish before the preview screenshot");
    assert.notEqual(finalDisplayState.centerDisplay, "none", browserName + ": live hologram remains visible after navigation");
    assert.ok(finalDisplayState.ringAnimations > 0, browserName + ": orbital motion remains active after navigation");
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
          const cached = await cache.match(new URL("./assets/alvis-app.css", location.href).href);
          if (cached) return { name, status: cached.status };
        }
        return null;
      });
      assert.ok(cacheInfo && cacheInfo.status === 200, "Chromium: critical ALVIS stylesheet must be in the app-shell cache");

      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await context.setOffline(true);
      const offlineNavigation = await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      assert.ok(offlineNavigation && offlineNavigation.ok(), "Chromium: integrated app shell must reload offline");
      await page.evaluate(() => {
        document.getElementById("lockPanel")?.classList.add("hidden");
        document.getElementById("appPanel")?.classList.remove("hidden");
      });
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".hud-center")).display !== "none");
      const offlineProbe = await page.evaluate(async () => {
        const response = await fetch("./__alvis_offline_probe__?nonce=" + Date.now(), { cache: "no-store" });
        return { status: response.status, body: await response.text() };
      });
      assert.equal(offlineProbe.status, 503, "Chromium: an uncached request must use the Service Worker offline fallback");
      assert.match(offlineProbe.body, /ALVIS: オフライン/, "Chromium: the offline fallback response must be served");
    }

    console.log("PASS " + browserName + ": live hologram globe, animated orbital rings, menu navigation, memory/growth actions, AI hit area, and chat composer");
    if (verifyOffline) console.log("PASS Chromium: Service Worker precache and offline reload");
    if (pageErrors.length) console.log(browserName + " page errors observed: " + JSON.stringify(pageErrors));
  } finally {
    await browser.close();
  }
}


async function verifyRefreshFlow(browserType) {
  const browserName = browserType.name();
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  try {
    const refreshUrl = new URL("refresh.html", previewUrl).href;
    await page.goto(refreshUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => {
      const current = new URL(window.location.href);
      return current.pathname.endsWith("/index-integrated.html");
    }, null, { timeout: 60000 });
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration("./");
      const worker = registration?.active;
      if (!worker) return { active: false, cacheName: "" };
      const cacheName = await new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => {
          channel.port1.close();
          resolve(event.data?.cacheName || "");
        };
        worker.postMessage({ type: "ALVIS_GET_BUILD_INFO" }, [channel.port2]);
      });
      return {
        active: worker.state === "activated",
        controller: !!navigator.serviceWorker.controller,
        cacheName
      };
    });
    assert.equal(state.active, true, browserName + ": refresh flow must leave an activated worker");
    assert.match(state.cacheName, /^alvis-cache-v\d+-integrated$/,
      browserName + ": refresh flow must verify the active integrated ALVIS worker before redirecting");
    console.log("PASS " + browserName + ": deployed refresh page activates and verifies the current integrated worker before redirect");
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
      window.startAlvisHudMotion?.(); // mirrors the real unlock() post-transition startup
    });
    await page.waitForFunction(() => {
      const stage = document.querySelector(".jarvis-stage");
      const globe = stage?.querySelector(".hud-globe-map");
      return !!globe && getComputedStyle(globe).display !== "none" &&
        globe.getBoundingClientRect().width > 80;
    }, null, { timeout: 15000 });
    const ringMotion = await page.locator(".jarvis-stage .hud-orbit-a").evaluate(ring => ring.getAnimations().length);
    assert.ok(ringMotion > 0, "iPhone WebKit: orbital ring animation must start in the live ALVIS mode");
    console.log("PASS iPhone WebKit: initial password screen and live ALVIS hologram render without uncaught errors");
    if (consoleErrors.length) console.log("iPhone WebKit console errors: " + JSON.stringify(consoleErrors));
  } finally {
    await browser.close();
  }
}

await verifyRefreshFlow(chromium);
await verifyRefreshFlow(webkit);
await verifyBrowser(chromium, true);
await verifyBrowser(webkit, false);
await verifyMobileWebKit();
console.log("All deployed dashboard browser smoke checks passed.");