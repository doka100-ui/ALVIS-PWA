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
check("ALVIS mode uses the approved 700x564 dashboard artwork", stage.includes('src="./assets/alvis-dashboard-reference.avif"') && stage.includes('width="700" height="564"'));
check("the stage preserves the artwork aspect ratio without a generated crop", appStyles.includes("aspect-ratio:700/564!important") && appStyles.includes("object-fit:fill!important"));
check("the legacy globe, projector, pedestal and rings are hidden beneath the artwork", /mode-stage\.jarvis-stage>\.hud-center,\s*#chatPage/.test(appStyles) && appStyles.includes(">.hud-caption{display:none!important}"));
check("legacy side glass panels and chart bars do not overlay the approved artwork", [".hud-side-left::before", ".hud-side-left::after", ".hud-side-right::before", ".hud-side-right::after"].every(selector => appStyles.includes(selector)) && appStyles.includes("content:none!important;") && appStyles.includes("display:none!important;"));
check("the left navigation keeps all five existing page destinations", menuCount === 5 && ["chatPage", "candidatePage", "memoryPage", "historyPage", "syncPage"].every(id => stage.includes('data-page="' + id + '"')));
check("the local AI launch button remains connected and overlays the image status area", stage.includes('id="hudAiAction"') && app.includes('$("hudAiAction")?.addEventListener("click"'));
check("the right memory and growth hotspots are wired to existing page navigation", stage.includes('class="hud-info-action hud-interface-action" data-hud-action="memory"') && stage.includes('class="hud-info-action hud-interface-action" data-hud-action="growth"') && app.includes('.hud-interface-action[data-hud-action]'));
check("legacy HUD motion stops while the approved image stage is active", app.includes('stage.querySelector(".alvis-reference-image")'));
check("the actual chat composer remains outside the static artwork", app.includes('id="chatInput"') && app.includes('id="sendChat"'));
check("ALVIS and Avatar display modes remain separate", app.includes('id="jarvisModeButton"') && app.includes('id="avatarModeButton"') && app.includes('id="alvisAvatarCanvas"'));
check("encrypted memory, history, synchronization, backup and Kokoro code remain", app.includes("encryptData") && app.includes("data.history") && app.includes("saveCloudCore") && app.toLowerCase().includes("backup") && app.includes("Kokoro"));
check("the app shell cache is v288 and precaches the approved artwork", sw.includes('alvis-cache-v288-integrated') && sw.includes('"./assets/alvis-dashboard-reference.avif"'));
check("the diagnostic distinguishes the HTML build from the live controlling Worker version", app.includes('const ALVIS_APP_BUILD_ID="v288"') && app.includes("ALVIS_GET_BUILD_INFO") && sw.includes("ALVIS_GET_BUILD_INFO") && app.includes("制御中Workerのキャッシュ版"));
check("Service Worker update starts after the initial page scripts", app.indexOf("function waitForAlvisServiceWorkerActivation") > app.indexOf("updateHudClock();") && app.includes("alvisServiceWorkerReady=(async()=>{") && !app.includes("__alvisEarlyServiceWorkerReady"));
check("the independent dependency cache remains separate", sw.includes('const DEPENDENCY_CACHE_NAME = "alvis-deps-v2"') && sw.includes('key.startsWith("alvis-deps-")'));
check("the on-device startup diagnostic measures the real integrated login screen", startupCheck.includes('frame.src="./index-integrated.html?startup-check="') && startupCheck.includes('getElementById("lockPanel")') && startupCheck.includes("loginVisibleMs"));
check("the startup diagnostic reports worker/cache versions without reading user data", startupCheck.includes("sw.controller") && startupCheck.includes('caches.keys()') && !startupCheck.includes("indexedDB.open") && !startupCheck.includes("localStorage.getItem"));
console.log(checks.map(name => "PASS " + name).join("\n"));
console.log(checks.length + "/" + checks.length + " dashboard-image checks passed.");
