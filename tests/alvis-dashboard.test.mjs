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
const navStart = stage.indexOf('<nav class="hud-nav" aria-label="ALVISメニュー">');
const navEnd = stage.indexOf("</nav>", navStart);
const nav = navStart >= 0 && navEnd > navStart ? stage.slice(navStart, navEnd) : "";
const orbitMarkup = stage.match(/class="hud-orbit hud-orbit-[abc]"/g) || [];

check("ALVIS mode uses the original live v188 HUD rather than a static image",
  stage.includes('<div class="hud-center">') &&
  stage.includes('class="hud-core"') &&
  stage.includes('class="hud-globe-map"') &&
  stage.includes('class="hud-side hud-side-left"') &&
  stage.includes('class="hud-side hud-side-right"') &&
  !stage.includes('class="alvis-reference-image"') &&
  !app.includes("v259: show the approved dashboard artwork"));
check("the three original independent orbital rings remain in the live HUD",
  orbitMarkup.length === 3 &&
  ["hud-orbit-a", "hud-orbit-b", "hud-orbit-c"].every(name => stage.includes('class="hud-orbit '+name+'"')));
check("the original projector, beam, globe and platform remain",
  stage.includes('class="hud-projector"') &&
  stage.includes('class="hud-beam"') &&
  stage.includes('class="hud-platform"'));
check("the three rings are scaled to 75 percent without changing the globe or stage",
  app.includes("#chatPage[data-display-mode=\"jarvis\"] .display-dock .hud-center .hud-orbit-a") &&
  app.includes("scale:.75!important") &&
  app.includes(".hud-orbit-b,") &&
  app.includes(".hud-orbit-c{"));
check("the three independent ring rotations are gently slowed by 25 percent",
  app.includes('from:"-24deg",to:"336deg",duration:27500') &&
  app.includes('from:"58deg",to:"-302deg",duration:38750') &&
  app.includes('from:"0deg",to:"360deg",duration:52500'));
check("the five original left-side menu actions remain connected",
  ["chatPage", "candidatePage", "memoryPage", "historyPage", "syncPage"]
    .every(page => nav.includes('data-page="' + page + '"')));
check("the original right-side HUD actions remain connected",
  stage.includes('data-hud-action="memory"') &&
  stage.includes('data-hud-action="growth"') &&
  app.includes('data-page="devicePage"'));
check("the existing AI launch button remains unique and connected",
  (app.match(/id="hudAiAction"/g) || []).length === 1 &&
  stage.includes('id="hudAiAction"') &&
  app.includes('$("hudAiAction")?.addEventListener("click"'));
check("zoom-time rendering safeguards remain in the ALVIS mode",
  app.includes("function updateAlvisZoomRenderMode()") &&
  app.includes("function setAlvisHudZoomAnimationState(zoomed)") &&
  app.includes('window.addEventListener("gesturestart"') &&
  app.includes('window.addEventListener("gesturechange"') &&
  app.includes('window.addEventListener("gestureend"'));
check("Avatar mode remains a separate presentation mode",
  app.includes('id="alvisAvatarCanvas"') &&
  app.includes('#chatPage[data-display-mode="avatar"] .jarvis-stage{display:none'));
check("chat, local inference, memory, history, encryption, sync, backup and voice remain",
  app.includes('id="chatInput"') &&
  app.includes('id="sendChat"') &&
  app.includes("async function sendToAlvis()") &&
  app.includes("encryptData") &&
  app.includes("saveLocal") &&
  app.includes("saveCloudCore") &&
  app.toLowerCase().includes("backup") &&
  app.includes("Kokoro") &&
  app.includes("data.history"));
check("Service Worker uses the v260 shell cache and preserves model/dependency caches",
  sw.includes('const CACHE_NAME = "alvis-cache-v260-integrated";') &&
  sw.includes('const DEPENDENCY_CACHE_NAME = "alvis-deps-v2";') &&
  !sw.includes("./assets/alvis-dashboard-reference.avif"));
check("Service Worker activation still preserves non-ALVIS model and user-data caches",
  sw.includes('key.startsWith("alvis-cache-")') &&
  sw.includes('key.startsWith("alvis-deps-")'));
const openScripts = (app.match(/<script\\b/gi) || []).length;
const closeScripts = (app.match(/<\\/script\\s*>/gi) || []).length;
check("the HTML script tags remain balanced", openScripts === closeScripts);

for (const name of checks) console.log("PASS " + name);
console.log(checks.length + "/" + checks.length + " ALVIS live-HUD checks passed.");
