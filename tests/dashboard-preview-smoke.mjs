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
    const response = await page.goto(previewUrl, {
      waitUntil: "domcontentloaded",
      timeout: 120000
    });
    assert.ok(response && response.ok(), browserName + ": preview document must return HTTP 200");
    await waitForDashboardImage(page);

    const imageState = await page.evaluate(() => {
      const image = document.querySelector(".alvis-reference-image");
      return {
        src: image.currentSrc,
        width: image.naturalWidth,
        height: image.naturalHeight
      };
    });
    assert.ok(imageState.src.includes("/assets/alvis-dashboard-reference.avif"), browserName + ": the approved AVIF must be requested");
    assert.equal(imageState.width, 700, browserName + ": approved artwork width");
    assert.equal(imageState.height, 564, browserName + ": approved artwork height");
    assert.ok(imageResponses.some(item => item.status === 200), browserName + ": approved artwork request must return HTTP 200");

    const loginGate = await page.evaluate(() => ({
      loginVisible: !document.getElementById("lockPanel").classList.contains("hidden"),
      appHidden: document.getElementById("appPanel").classList.contains("hidden")
    }));
    assert.deepEqual(loginGate, { loginVisible: true, appHidden: true }, browserName + ": the real password gate must remain intact");

    // Reveal only the already-rendered app shell in this disposable test browser.
    // No password is submitted and no encrypted user data is read or changed.
    await page.evaluate(() => {
      document.getElementById("lockPanel").classList.add("hidden");
      document.getElementById("appPanel").classList.remove("hidden");
    });
    await page.waitForFunction(() => {
      const chat = document.getElementById("chatPage");
      return !!chat && !chat.classList.contains("hidden");
    });

    const layout = await page.evaluate(() => {
      const stage = document.querySelector(".mode-stage.jarvis-stage");
      const image = document.querySelector(".alvis-reference-image");
      const rect = stage.getBoundingClientRect();
      return {
        imageDisplay: getComputedStyle(image).display,
        objectFit: getComputedStyle(image).objectFit,
        ratio: rect.width / rect.height,
        legacyCenterDisplay: getComputedStyle(stage.querySelector(".hud-center")).display
      };
    });
    assert.equal(layout.imageDisplay, "block", browserName + ": the approved image must be visible in ALVIS mode");
    assert.equal(layout.objectFit, "fill", browserName + ": the complete artwork must not be cropped");
    assert.ok(Math.abs(layout.ratio - 700 / 564) < 0.01, browserName + ": stage ratio must match the image");
    assert.equal(layout.legacyCenterDisplay, "none", browserName + ": legacy globe/rings must not be drawn over the artwork");

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
    await globalChat.click();
    await page.locator('.hud-side-right .hud-info-action[data-hud-action="growth"]').click();
    await page.waitForFunction(() => {
      const target = document.getElementById("growthPage");
      return !!target && !target.classList.contains("hidden");
    });

    await globalChat.click();
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
        await waitForDashboardImage(page);
        controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
      }
      assert.equal(controlled, true, "Chromium: app shell must be controlled by the Service Worker");

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
      const offlineImageResponse = await offlineImageResponsePromise;
      assert.equal(offlineImageResponse.status(), 200, "Chromium: dashboard image must load offline");
      assert.equal(offlineImageResponse.fromServiceWorker(), true, "Chromium: offline image must come from the Service Worker cache");
      await waitForDashboardImage(page);
      assert.equal(await page.evaluate(() => navigator.onLine), false, "Chromium: offline test must really be offline");
    }

    console.log("PASS " + browserName + ": deployed image, no-crop layout, menu navigation, memory/growth actions, AI hit area, and chat composer");
    if (verifyOffline) console.log("PASS Chromium: Service Worker precache and offline reload");
    if (pageErrors.length) console.log(browserName + " page errors observed: " + JSON.stringify(pageErrors));
  } finally {
    await browser.close();
  }
}

await verifyBrowser(chromium, true);
await verifyBrowser(webkit, false);
console.log("All deployed dashboard browser smoke checks passed.");