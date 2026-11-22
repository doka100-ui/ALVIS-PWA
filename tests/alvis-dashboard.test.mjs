import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, appCss, sw, image, startupCheck] = await Promise.all([
  readFile(new URL("../index-integrated.html", import.meta.url), "utf8"),
  readFile(new URL("../assets/alvis-app.css", import.meta.url), "utf8"),
  readFile(new URL("../service-worker.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/alvis-dashboard-reference.avif", import.meta.url)),
  readFile(new URL("../startup-check.html", import.meta.url), "utf8")
]);
const appStyles = app + appCss;
const checks = [];
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
}
const stageStart = app.indexOf('<div class="mode-stage jarvis-stage"');
const stageEnd = app.indexOf('<div class="alvis-chat-area"', stageStart);
const stage = stageStart >= 0 && stageEnd > stageStart ? app.slice(stageStart, stageEnd) : "";
const menuCount = (stage.match(/class="hud-shortcut" data-page=/g) || []).length;

check("the approved dashboard asset exists as a valid AVIF file", image.length > 20000 && image.toString("ascii", 4, 12) === "ftypavif");
check("the approved 700x564 reference artwork remains available without replacing the live HUD", stage.includes('src="./assets/alvis-dashboard-reference.avif"') && stage.includes('width="700" height="564"'));
check("ALVIS mode restores the responsive live HUD stage and globe", appStyles.includes('#chatPage[data-display-mode="jarvis"] .display-dock .mode-stage.jarvis-stage{') && appStyles.includes("hud-globe-map") && appStyles.includes("display:grid!important"));
check("the static reference image is hidden while the live globe and rings are displayed", appStyles.includes(">.alvis-reference-image{display:none!important}") && appStyles.includes(">.hud-center{display:grid!important;visibility:visible!important}"));
check("the original live left and right HUD panels remain visible", appStyles.includes(">.hud-side{") && appStyles.includes(">.hud-center{display:grid!important;visibility:visible!important}"));
check("the left navigation keeps all five existing page destinations", menuCount === 5 && ["chatPage", "candidatePage", "memoryPage", "historyPage", "syncPage"].every(id => stage.includes('data-page="' + id + '"')));
check("the local AI launch button remains connected to the live HUD", stage.includes('id="hudAiAction"') && app.includes('$("hudAiAction")?.addEventListener("click"'));
check("the right memory and growth hotspots are wired to existing page navigation", stage.includes('class="hud-info-action hud-interface-action" data-hud-action="memory"') && stage.includes('class="hud-info-action hud-interface-action" data-hud-action="growth"') && app.includes('.hud-interface-action[data-hud-action]'));
check("the outer ALVIS ring rotates independently without changing its centered translate", appCss.includes("animation:alvisHudOuterRotate298 42s linear infinite!important") && appCss.includes("from{rotate:9deg}") && appCss.includes("to{rotate:369deg}") && appCss.includes("top:48%!important"));
check("the ALVIS outer ring has evenly spaced fine gear teeth", appCss.includes("hud-orbit-c::before") && appCss.includes("repeating-conic-gradient") && appCss.includes("5.625deg"));
check("the ALVIS outer ring has evenly spaced fine gear teeth", appCss.includes("hud-orbit-c::before") && appCss.includes("repeating-conic-gradient") && appCss.includes("5.625deg"));
check("the actual chat composer remains outside the static artwork", app.includes('id="chatInput"') && app.includes('id="sendChat"'));
check("ALVIS and Avatar display modes remain separate", app.includes('id="jarvisModeButton"') && app.includes('id="avatarModeButton"') && app.includes('id="alvisAvatarCanvas"'));
check("encrypted memory, history, synchronization, backup and Kokoro code remain", app.includes("encryptData") && app.includes("data.history") && app.includes("saveCloudCore") && app.toLowerCase().includes("backup") && app.includes("Kokoro"));
check("the v292 app shell activates with only login-critical assets and caches app assets on demand", sw.includes('alvis-cache-v298-integrated') && sw.includes("REQUIRED_FILES_TO_CACHE") && sw.includes("url.origin === self.location.origin") && sw.includes("cache.put(cacheRequest, response.clone())"));
check("the diagnostic distinguishes the page build, controlling Worker, and registered active Worker", app.includes('const ALVIS_APP_BUILD_ID="v298"') && app.includes("ALVIS_GET_BUILD_INFO") && sw.includes("ALVIS_GET_BUILD_INFO") && app.includes("現在この画面を制御するWorker版") && app.includes("登録済みactive Worker版"));
check("the diagnostic separates all ALVIS app caches from the caches reported by live Workers without deleting any cache", app.includes("ALVISアプリキャッシュ一覧") && app.includes("制御中Workerのキャッシュ") && app.includes("登録済みactive Workerのキャッシュ") && app.includes("現Worker以外のALVISキャッシュ") && !app.includes("caches.delete("));
check("Service Worker update starts after the initial page scripts", app.indexOf("function waitForAlvisServiceWorkerActivation") > app.indexOf("updateHudClock();") && app.includes("alvisServiceWorkerReady=(async()=>{") && !app.includes("__alvisEarlyServiceWorkerReady"));
check("the independent dependency cache remains separate", sw.includes('const DEPENDENCY_CACHE_NAME = "alvis-deps-v2"') && sw.includes('key.startsWith("alvis-deps-")'));
check("the on-device startup diagnostic measures the real integrated login screen", startupCheck.includes('frame.src="./index-integrated.html?startup-check="') && startupCheck.includes('getElementById("lockPanel")') && startupCheck.includes("loginVisibleMs"));
check("the startup diagnostic reports worker/cache versions without reading user data", startupCheck.includes("sw.controller") && startupCheck.includes('caches.keys()') && !startupCheck.includes("indexedDB.open") && !startupCheck.includes("localStorage.getItem"));
console.log(checks.map(name => "PASS " + name).join("\n"));
console.log(checks.length + "/" + checks.length + " dashboard-image checks passed.");
