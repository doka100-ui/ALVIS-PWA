import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, sw, image] = await Promise.all([
  readFile(new URL("../index-integrated.html", import.meta.url), "utf8"),
  readFile(new URL("../service-worker.js", import.meta.url), "utf8"),
  readFile(new URL("../assets/alvis-dashboard-reference.avif", import.meta.url))
]);

const checks = [];
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
}

const imageTag = app.match(/<img class="alvis-reference-image"[^>]+>/)?.[0] || "";
check("the approved AVIF dashboard is the single visible reference image",
  (app.match(/class="alvis-reference-image"/g) || []).length === 1 &&
  imageTag.includes('src="./assets/alvis-dashboard-reference.avif"') &&
  imageTag.includes('width="700" height="564"'));
check("the image binary is registered and has a valid AVIF file signature",
  image.length > 20000 && image.length < 60000 &&
  image.subarray(4, 12).toString("ascii") === "ftypavif");
check("the source image aspect ratio is preserved without filters or transforms",
  app.includes("aspect-ratio:1397/1126") &&
  app.includes("object-fit:fill!important") &&
  app.includes("filter:none!important") &&
  app.includes("transform:none!important"));
check("the old vector globe and side panels cannot cover the selected artwork",
  app.includes(".display-dock .mode-stage.jarvis-stage>.hud-center") &&
  app.includes(".display-dock .mode-stage.jarvis-stage>.hud-side-right") &&
  app.includes("display:none!important"));
check("the image does not receive duplicate CSS orbit elements",
  !app.includes('class="alvis-motion-orbit'));
check("the left menu retains all existing pages plus Chat",
  ["chatPage", "candidatePage", "memoryPage", "historyPage", "syncPage"]
    .every(page => app.includes('data-page="' + page + '"')));
check("the right-side system, memory, and growth hotspots are present",
  ["devicePage", "memoryPage", "growthPage"]
    .every(page => app.includes('data-page="' + page + '"')) &&
  app.includes('class="alvis-reference-right-hotspots"'));
check("the existing AI launch button remains connected",
  (app.match(/id="hudAiAction"/g) || []).length === 1);
check("the chat composer and send control remain in the page",
  app.includes('class="alvis-chat-area"') &&
  app.includes('id="chatInput"') &&
  app.includes('id="sendChat"') &&
  app.includes("async function sendToAlvis()"));
check("avatar mode continues to hide the ALVIS image stage",
  app.includes('#chatPage[data-display-mode="avatar"] .display-dock .mode-stage.jarvis-stage{display:none!important}'));
check("Service Worker v234 precaches the dashboard for offline use",
  sw.includes('const CACHE_NAME = "alvis-cache-v234-integrated";') &&
  sw.includes('./assets/alvis-dashboard-reference.avif'));
const openScripts = (app.match(/<script\b/gi) || []).length;
const closeScripts = (app.match(/<\/script\s*>/gi) || []).length;
check("the HTML script tags remain balanced", openScripts === closeScripts);

for (const name of checks) console.log("PASS " + name);
console.log(checks.length + "/" + checks.length + " ALVIS dashboard checks passed.");
