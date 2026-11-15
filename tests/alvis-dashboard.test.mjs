import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, sw] = await Promise.all([
  readFile(new URL("../index-integrated.html", import.meta.url), "utf8"),
  readFile(new URL("../service-worker.js", import.meta.url), "utf8")
]);
const checks=[];
function check(name,condition){assert.ok(condition,name);checks.push(name);}
const stageStart=app.indexOf('<div class="mode-stage jarvis-stage"');
const stageEnd=app.indexOf('<div class="alvis-chat-area"',stageStart);
const stage=stageStart>=0&&stageEnd>stageStart?app.slice(stageStart,stageEnd):"";
const centerStart=stage.indexOf('<div class="hud-center">');
const centerEnd=stage.indexOf('<div class="hud-side hud-side-right">',centerStart);
const center=centerStart>=0&&centerEnd>centerStart?stage.slice(centerStart,centerEnd):"";
check("ALVIS mode uses the live v188-style HUD, not a flattened artwork",!stage.includes('class="alvis-reference-image"')&&center.includes('class="hud-globe-map"'));
check("the central holographic globe, projector and pedestal remain",center.includes('class="hud-projector"')&&center.includes('class="hud-platform"')&&center.includes('class="hud-globe-map"'));
check("three orbital rings remain in the live HUD",(center.match(/class="hud-orbit hud-orbit-[abc]"/g)||[]).length===3&&center.includes("hud-orbit-c"));
check("only the two inner rings are reduced while the outer ring keeps its original size",app.includes("hud-orbit-a{\n  width:60.75%!important;height:22.5%!important;")&&app.includes("hud-orbit-b{\n  width:56.25%!important;height:30.375%!important;")&&app.includes("hud-orbit-c{\n  display:block!important;width:125%!important;height:31%!important;"));
check("the two inner rings rotate and the outer ring remains static",app.includes('querySelectorAll(".hud-center .hud-orbit:not(.hud-orbit-c)")')&&app.includes('duration:27500')&&app.includes('duration:38750'));
check("left and right HUD panels and navigation remain",stage.includes('class="hud-side hud-side-left"')&&stage.includes('class="hud-side hud-side-right"')&&stage.includes('class="hud-nav"'));
check("both display modes and shared AI functions remain",app.includes('id="jarvisModeButton"')&&app.includes('id="avatarModeButton"')&&app.includes("async function sendToAlvis()"));
check("Avatar mode remains independently hidden when ALVIS mode is selected",/#chatPage\[data-display-mode="avatar"\] \.display-dock>\.alvis-hologram-frame>\.mode-stage\.jarvis-stage\{\s*display:none!important/.test(app)&&app.includes('id="alvisAvatarCanvas"'));
check("memory, history, encrypted storage, sync, backup and voice remain",app.includes("encryptData")&&app.includes("data.history")&&app.includes("saveCloudCore")&&app.toLowerCase().includes("backup")&&app.includes("Kokoro"));
check("Service Worker v263 does not precache the flattened dashboard artwork",sw.includes('alvis-cache-v263-integrated')&&!sw.includes("alvis-dashboard-reference.avif"));
check("Service Worker preserves the independent dependency cache",sw.includes('const DEPENDENCY_CACHE_NAME = "alvis-deps-v2"')&&sw.includes('key.startsWith("alvis-deps-")'));
console.log(checks.map(name=>"PASS "+name).join("\n"));
console.log(checks.length+"/"+checks.length+" live HUD checks passed.");
