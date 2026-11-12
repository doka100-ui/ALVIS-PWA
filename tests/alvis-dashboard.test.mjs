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

const stageStart = app.indexOf('<div class="mode-stage jarvis-stage"');
const stageEnd = app.indexOf('<div class="alvis-chat-area"', stageStart);
const stage = stageStart >= 0 && stageEnd > stageStart ? app.slice(stageStart, stageEnd) : "";
const imageTag = stage.match(/<img class="alvis-reference-image"[^>]+>/)?.[0] || "";
const navStart = stage.indexOf('<nav class="hud-nav" aria-label="ALVISメニュー">');
const navEnd = stage.indexOf("</nav>", navStart);
const nav = navStart >= 0 && navEnd > navStart ? stage.slice(navStart, navEnd) : "";
const hotspotsStart = stage.indexOf('<div class="alvis-reference-right-hotspots"');
const hotspotsEnd = stage.indexOf("</div>", hotspotsStart);
const hotspots = hotspotsStart >= 0 && hotspotsEnd > hotspotsStart ? stage.slice(hotspotsStart, hotspotsEnd) : "";
const imageCssStart = app.lastIndexOf("/* v259: show the approved dashboard artwork");
const imageCssEnd = app.lastIndexOf("</style>");
const imageCss = imageCssStart >= 0 && imageCssEnd > imageCssStart ? app.slice(imageCssStart, imageCssEnd) : "";

check("the approved 700×564 AVIF artwork is the single ALVIS reference image",
  (app.match(/class="alvis-reference-image"/g) || []).length === 1 &&
  imageTag.includes('src="./assets/alvis-dashboard-reference.avif"') &&
  imageTag.includes('width="700" height="564"'));
check("the registered binary is the expected AVIF format and size",
  image.length > 20000 && image.length < 60000 &&
  image.subarray(4, 12).toString("ascii") === "ftypavif");
check("the original 1397:1126 composition is shown without filters or transforms",
  imageCss.includes("aspect-ratio:1397/1126") &&
  imageCss.includes("object-fit:fill!important") &&
  imageCss.includes("filter:none!important") &&
  imageCss.includes("transform:none!important"));
check("the selected image is the only visible globe, orbit, projector and panel artwork",
  imageCss.includes(">.hud-side-right") &&
  imageCss.includes(">.hud-center") &&
  imageCss.includes("display:none!important") &&
  !stage.includes('class="alvis-motion-orbit'));
check("the five image-aligned left menu controls map to the existing pages",
  ["chatPage", "candidatePage", "memoryPage", "historyPage", "syncPage"]
    .every(page => nav.includes('data-page="' + page + '"')));
check("left menu controls are transparent, touchable and keyboard-focusable",
  imageCss.includes("opacity:.001!important") &&
  imageCss.includes("pointer-events:auto!important") &&
  imageCss.includes("touch-action:manipulation!important") &&
  imageCss.includes(":focus-visible"));
check("the existing AI launch button remains unique and connected",
  (app.match(/id="hudAiAction"/g) || []).length === 1 &&
  stage.includes('id="hudAiAction"') &&
  app.includes('$("hudAiAction")?.addEventListener("click"'));
check("left menu and AI hit areas align to the selected artwork",
  imageCss.includes("left:3.4%!important;top:22.3%!important") &&
  imageCss.includes("left:3.4%!important;top:56.1%!important"));
check("right device, memory and growth hotspots map to existing pages",
  ["devicePage", "memoryPage", "growthPage"]
    .every(page => hotspots.includes('data-page="' + page + '"')) &&
  hotspots.includes('aria-label="端末診断"') &&
  hotspots.includes('aria-label="好み・長期記憶"') &&
  hotspots.includes('aria-label="プロジェクト・成長"'));
check("right-side hit areas align to the selected artwork",
  imageCss.includes("left:76.4%!important;top:21.5%!important") &&
  imageCss.includes("left:76.4%!important;top:42%!important") &&
  imageCss.includes("left:76.4%!important;top:47.1%!important"));
check("all dashboard page buttons use the existing navigation handler",
  app.includes('document.querySelectorAll("button[data-page]")') &&
  app.includes("navigateAlvisPage(button.dataset.page)"));
check("chat input, send, local inference and both display modes remain",
  app.includes('id="chatInput"') &&
  app.includes('id="sendChat"') &&
  app.includes("async function sendToAlvis()") &&
  app.includes('id="jarvisModeButton"') &&
  app.includes('id="avatarModeButton"'));
check("encrypted memory, history, cloud sync, backup and voice code remain",
  app.includes("encryptData") &&
  app.includes("saveLocal") &&
  app.includes("saveCloudCore") &&
  app.toLowerCase().includes("backup") &&
  app.includes("Kokoro") &&
  app.includes("data.history"));
check("avatar mode remains separate and hides the ALVIS artwork stage",
  imageCss.includes('#chatPage[data-display-mode="avatar"] .display-dock .mode-stage.jarvis-stage{display:none!important}') &&
  app.includes('id="alvisAvatarCanvas"'));
check("Service Worker v259 precaches the approved artwork and preserves dependency cache",
  sw.includes('const CACHE_NAME = "alvis-cache-v259-integrated";') &&
  sw.includes('./assets/alvis-dashboard-reference.avif') &&
  sw.includes('const DEPENDENCY_CACHE_NAME = "alvis-deps-v2";'));
check("Service Worker activation preserves non-ALVIS model and user-data caches",
  sw.includes('key.startsWith("alvis-cache-")') &&
  sw.includes('key.startsWith("alvis-deps-")'));
const openScripts = (app.match(/<script\b/gi) || []).length;
const closeScripts = (app.match(/<\/script\s*>/gi) || []).length;
check("the HTML script tags remain balanced", openScripts === closeScripts);

for (const name of checks) console.log("PASS " + name);
console.log(checks.length + "/" + checks.length + " ALVIS approved-dashboard checks passed.");
