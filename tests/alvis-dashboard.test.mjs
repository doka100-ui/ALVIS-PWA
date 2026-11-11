import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, sw] = await Promise.all([
  readFile(new URL("../index-integrated.html", import.meta.url), "utf8"),
  readFile(new URL("../service-worker.js", import.meta.url), "utf8")
]);

const checks = [];
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
}

const stageStart = app.indexOf('<div class="mode-stage jarvis-stage"');
const stageEnd = app.indexOf('<div class="alvis-chat-area"', stageStart);
const stage = stageStart >= 0 && stageEnd > stageStart ? app.slice(stageStart, stageEnd) : "";

check("ALVIS mode uses the live hologram stage and not the obsolete static reference image",
  stageStart >= 0 &&
  !stage.includes('class="alvis-reference-image"') &&
  !stage.includes('alvis-dashboard-reference.avif') &&
  !stage.includes('class="alvis-reference-right-hotspots"'));
check("the central hologram globe is live SVG artwork",
  stage.includes('class="hud-globe-map"') &&
  stage.includes('aria-label="青く輝くホログラム球体"'));
check("all three orbital rings remain live DOM elements",
  ["hud-orbit-a", "hud-orbit-b", "hud-orbit-c"]
    .every(name => stage.includes('class="hud-orbit ' + name + '"')));
check("the three orbital rings keep their independent 22/31/42 second motion",
  app.includes('duration:22000') &&
  app.includes('duration:31000') &&
  app.includes('duration:42000'));
check("projector, light beam and hologram platform remain visible components",
  stage.includes('class="hud-projector"') &&
  stage.includes('class="hud-beam"') &&
  stage.includes('class="hud-platform"'));
check("both live information panels remain in the stage",
  stage.includes('class="hud-side hud-side-left"') &&
  stage.includes('class="hud-side hud-side-right"'));
check("the five left-side menu controls remain connected to existing pages",
  ["chatPage", "candidatePage", "memoryPage", "historyPage", "syncPage"]
    .every(page => stage.includes('data-page="' + page + '"')));
check("the existing local AI launch control remains connected",
  (app.match(/id="hudAiAction"/g) || []).length === 1 &&
  stage.includes('id="hudAiAction"') &&
  app.includes('$("hudAiAction")?.addEventListener("click"'));
check("the right panel keeps its real memory and growth actions",
  stage.includes('data-hud-action="memory"') &&
  stage.includes('data-hud-action="growth"'));
check("device diagnostics remains reachable through the existing navigation",
  app.includes('<button data-page="devicePage">端末診断</button>'));
check("no v245 image overlay CSS hides the live globe or right panel",
  !app.includes("/* v245: show the approved dashboard artwork") &&
  app.includes(".display-dock .mode-stage.jarvis-stage>.hud-side{display:block!important;visibility:visible!important}") &&
  app.includes(".display-dock .mode-stage.jarvis-stage>.hud-center{display:grid!important;visibility:visible!important}"));
check("Avatar mode stays separate and hides only the ALVIS stage",
  app.includes('#chatPage[data-display-mode="avatar"] .display-dock>.alvis-hologram-frame>.mode-stage.jarvis-stage{') && /#chatPage\[data-display-mode="avatar"\] \.display-dock>\.alvis-hologram-frame>\.mode-stage\.jarvis-stage\{\s*display:none!important/.test(app) &&
  app.includes('id="alvisAvatarCanvas"'));
check("chat, local inference, display mode switching and shared features remain",
  app.includes('id="chatInput"') &&
  app.includes('id="sendChat"') &&
  app.includes("async function sendToAlvis()") &&
  app.includes('id="jarvisModeButton"') &&
  app.includes('id="avatarModeButton"') &&
  app.includes("encryptData") &&
  app.includes("saveCloudCore") &&
  app.includes("Kokoro"));
check("Service Worker v248 refreshes only the ALVIS app shell, not model/dependency caches",
  sw.includes('const CACHE_NAME = "alvis-cache-v248-integrated";') &&
  !sw.includes("./assets/alvis-dashboard-reference.avif") &&
  sw.includes('const DEPENDENCY_CACHE_NAME = "alvis-deps-v2";') &&
  sw.includes('key.startsWith("alvis-cache-")') &&
  sw.includes('key.startsWith("alvis-deps-")'));
const openScripts = app.split("<script").length - 1;
const closeScripts = app.split("</script>").length - 1;
check("the HTML script tags remain balanced", openScripts === closeScripts);

for (const name of checks) console.log("PASS " + name);
console.log(checks.length + "/" + checks.length + " ALVIS live-HUD checks passed.");
