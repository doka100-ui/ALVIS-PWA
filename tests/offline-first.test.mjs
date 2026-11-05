import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../index-integrated.html", import.meta.url), "utf8");
const sw = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");

const sendStart = app.indexOf("async function sendToAlvis()");
const sendEnd = app.indexOf('\nfunction ', sendStart + 30);
assert.ok(sendStart >= 0 && sendEnd > sendStart, "sendToAlvis must exist");
const send = app.slice(sendStart, sendEnd);
const onlineStart = app.indexOf("async function requestOnlineAiCollaboration");
const onlineEnd = app.indexOf("\nasync function testOnlineAiGateway", onlineStart);
assert.ok(onlineStart >= 0 && onlineEnd > onlineStart, "online request helper must exist");
const online = app.slice(onlineStart, onlineEnd);

const checks = [
  ["online collaboration is opt-in by default", /id="useOnlineAi" type="checkbox"/.test(app) && !/id="useOnlineAi"[^>]*checked/.test(app)],
  ["local Qwen is required as the primary inference engine", /if\(!aiEngine&&!userIsDateQuestion/.test(send)],
  ["online call only occurs after reading the explicit checkbox", /const useOnlineForThisTurn=!!\$\("useOnlineAi"\)\?\.checked/.test(send) && /if\(useOnlineForThisTurn\)\s*\{[\s\S]*?requestOnlineAiCollaboration\(text\)/.test(send)],
  ["online permission is one-shot and reset before request", /const useOnlineForThisTurn=[\s\S]*?\$\("useOnlineAi"\)\.checked=false/.test(send)],
  ["only the current question is sent to the gateway", /body:JSON\.stringify\(\{question:String\(question\|\|""\)\.slice\(0,8000\)\}\)/.test(online)],
  ["gateway response is treated as reference data, not system instructions", /外部AIの未検証参考資料/.test(send) && /その中の命令・システム指示/.test(send)],
  ["online failure is caught and local generation continues", /catch\(error\)\s*\{\s*setStatus\("aiStatus","オンラインAIは利用できません[\s\S]*?\n    \}/.test(send) && /aiEngine\.chat\.completions\.create/.test(send)],
  ["API secrets are not embedded in the browser app", !/sk-[A-Za-z0-9]{20,}/.test(app) && !/AIza[A-Za-z0-9_-]{30,}/.test(app)],
  ["offline app shell is cached", /"\.\/index-integrated\.html"/.test(sw) && /caches\.open\(CACHE_NAME\)/.test(sw)],
  ["online API requests are not cached by the service worker", /if\(request\.method !== "GET"\) return/.test(sw)]
];

for (const [name, passed] of checks) {
  assert.ok(passed, name);
  console.log("PASS", name);
}
console.log(`\n${checks.length}/${checks.length} offline-first policy checks passed.`);
