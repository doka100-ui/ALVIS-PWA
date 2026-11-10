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

check("ALVIS mode uses the original live HTML/CSS hologram, not a replacement image",
  !app.includes('class="alvis-reference-image"') &&
  !app.includes('class="alvis-reference-scene"') &&
  !app.includes("alvis-dashboard-reference.avif"));
check("the original central hologram globe and three orbit rings are present",
  app.includes('class="hud-center"') &&
  app.includes('class="hud-globe-map"') &&
  ["hud-orbit-a", "hud-orbit-b", "hud-orbit-c"].every(name => app.includes('class="hud-orbit ' + name + '"')));
check("the original left and right live HUD panels and projector remain visible",
  app.includes('class="hud-side hud-side-left"') &&
  app.includes('class="hud-side hud-side-right"') &&
  app.includes('class="hud-projector"') &&
  app.includes('class="hud-platform"') &&
  app.includes('class="hud-caption"'));
check("the original AI launch button remains inside the left HUD",
  /class="hud-side hud-side-left"[\s\S]*?id="hudAiAction"[\s\S]*?<\/div>/.test(app) &&
  (app.match(/id="hudAiAction"/g) || []).length === 1);
check("the original menu shortcuts and right-side actions remain wired",
  ["candidatePage", "memoryPage", "historyPage", "syncPage", "devicePage", "growthPage"]
    .every(page => app.includes('data-page="' + page + '"')) &&
  app.includes('data-hud-action="memory"') &&
  app.includes('data-hud-action="growth"'));
check("three original orbital rings retain independent motion timing",
  app.includes('const orbitNodes=Array.from(stage.querySelectorAll(".hud-center .hud-orbit"))') &&
  app.includes('duration:22000') &&
  app.includes('duration:31000') &&
  app.includes('duration:42000'));
check("avatar mode remains separate and hides only the live ALVIS stage",
  app.includes('#chatPage[data-display-mode="avatar"] .jarvis-stage{display:none}'));
check("chat composer, AI inference and mode switching remain in the page",
  app.includes('class="alvis-chat-area"') &&
  app.includes('id="chatInput"') &&
  app.includes('id="sendChat"') &&
  app.includes("async function sendToAlvis()") &&
  app.includes('id="jarvisModeButton"') &&
  app.includes('id="avatarModeButton"'));
check("Service Worker refreshes only the ALVIS app shell cache",
  sw.includes('const CACHE_NAME = "alvis-cache-v242-integrated";') &&
  !sw.includes("alvis-dashboard-reference.avif") &&
  sw.includes('const DEPENDENCY_CACHE_NAME = "alvis-deps-v2";'));
const openScripts = (app.match(/<script\b/gi) || []).length;
const closeScripts = (app.match(/<\/script\s*>/gi) || []).length;
check("the HTML script tags remain balanced", openScripts === closeScripts);

for (const name of checks) console.log("PASS " + name);
console.log(checks.length + "/" + checks.length + " ALVIS live HUD checks passed.");
