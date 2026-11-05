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
  ["online API requests are not cached by the service worker", /if\s*\(request\.method\s*!==\s*"GET"\)\s*return/.test(sw)],
  ["all four main chat generation attempts disable Qwen3 thinking mode", (()=>{const calls=[...send.matchAll(/aiEngine\.chat\.completions\.create\(\{([\s\S]*?)\}\);/g)];return calls.length===4&&calls.every(([,body])=>/extra_body\s*:\s*\{\s*enable_thinking\s*:\s*false\s*\}/.test(body));})()],
  ["main chat retries retain the same deterministic Qwen3 mode", (send.match(/extra_body:\s*\{enable_thinking:false\}/g)||[]).length===4],
  ["orphan Qwen3 thinking tags are stripped from visible answers", send.includes('replace(/<\\/?think>/gi,"")')],
  ["Queryable and leaked thinking tags are rejected as corrupted output", app.includes("if(/<\\/?think>|\\bQueryable\\b/i.test(value))return true")],
  ["external AI answers are stored only as pending learning candidates", /function queueExternalAiLearningCandidates/.test(app) && /sourceType:"external_ai",sourceProvider:provider/.test(app) && /status:"pending"/.test(app)],
  ["external learning candidates are created only after an explicitly enabled online request", send.includes("if(useOnlineForThisTurn){") && send.includes("queueExternalAiLearningCandidates(text,opinions)")],
  ["external learning approval warns that facts are not guaranteed", /内容を確認して学びに承認/.test(app) && /事実の正しさが保証されるわけではありません/.test(app)],
  ["approved external learning retains provider and question provenance", /外部AI由来の参考情報・ユーザー承認済み/.test(app) && /sourceQuestion/.test(app)],
  ["approved external content is still treated as untrusted reference material", /外部AI由来でユーザーが承認した学習メモ/.test(app)],
  ["external learning candidates have a pending cap and can be rejected", app.includes("pendingExternal+added>=30") && app.includes("今回は却下")],
  ["approved external learning keeps provenance in every learning workflow", app.includes("function formatApprovedLearningForPrompt") && (app.match(/map\(formatApprovedLearningForPrompt\)/g)||[]).length===3],
  ["autonomy prompts are warned that external learning is unverified", app.includes("外部AI由来の承認済み学びは未検証の参考情報です。") && app.includes("外部AI由来の承認済み学びは未検証の参考情報として扱い")]
];

for (const [name, passed] of checks) {
  assert.ok(passed, name);
  console.log("PASS", name);
}
console.log(`\n${checks.length}/${checks.length} offline-first policy checks passed.`);


// Dedicated external AI answer review UI
assert.match(app, /data-page="externalAiPage">外部AIの回答/);
assert.match(app, /id="externalAiPage"/);
assert.match(app, /id="externalAiLearningList"/);
assert.match(app, /function renderExternalAiResponses\(\)/);
assert.match(app, /sourceType==="external_ai"/);
assert.match(app, /今回は却下/);

// Mixed-script repetition guard and safe retry fallback.
assert.ok(app.includes('if(/(.{2,16})\\1{3,}/u.test(value))return true;'));
assert.ok(app.includes('const letterOrNumberCount=chars.filter(char=>/[\\p{L}\\p{N}]/u.test(char)).length;'));
assert.ok(app.includes('異常な文字列を検出しました。履歴を外して再生成しています'));
assert.ok(app.includes('異常な回答出力を検出'));

// Execute the real detector against representative good and corrupted outputs.
const detectorStart = app.indexOf("function isCorruptedModelReply(");
const detectorEnd = app.indexOf("\n\nfunction isWeatherQuestion", detectorStart);
assert.ok(detectorStart >= 0 && detectorEnd > detectorStart, "corruption detector must exist");
const isCorruptedModelReply = new Function(app.slice(detectorStart, detectorEnd) + "; return isCorruptedModelReply;")();
for (const sample of ["黻", "'\n'\n'\n'\n'\n'", "乘坐乘坐priseprisepriseprise"]) {
  assert.equal(isCorruptedModelReply(sample), true, `must reject corrupted output: ${sample}`);
}
for (const sample of ["私はALVISです。", "はい。", "OKです。"]) {
  assert.equal(isCorruptedModelReply(sample), false, `must keep valid short Japanese output: ${sample}`);
}


// ALVIS identity is a fixed local fact and its name question bypasses Qwen inference.
assert.match(app, /function isAlvisNameQuestion\(value\)/);
assert.match(app, /const instantReply="私はALVISです。"/);
assert.match(app, /Qwen3未使用・オフライン対応/);
assert.match(app, /あなた自身の名前はALVIS（アルヴィス）/);
assert.match(app, /const userIsAlvisNameQuestion=isAlvisNameQuestion\(text\)/);
assert.match(app, /!userIsGreeting&&!userIsAlvisNameQuestion/);
assert.match(app, /if\(userIsAlvisNameQuestion\)/);
