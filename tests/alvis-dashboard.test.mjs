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
check("the outer ALVIS gear aligns to the globe core's exact 50%/42% anchor and keeps its independent rotation", app.includes('duration:22000') && appCss.includes("from{rotate:9deg}") && appCss.includes("to{rotate:369deg}") && appCss.includes("left:50%!important;top:42%!important") && appCss.includes("translate:-50% -50%!important") && appCss.includes("transform:none!important"));
check("the ALVIS outer ring uses a smooth precision rim with 48 subtle index marks and retains its fine inner ring detailing", (app.match(/class="gear-tick/g)||[]).length===48 && !app.includes('class="gear-tooth"') && app.includes('r="168.5"') && app.includes('r="155"') && app.includes('r="145"') && app.includes('r="139"') && appCss.includes(".gear-tick-major"));
check("the actual chat composer remains outside the static artwork", app.includes('id="chatInput"') && app.includes('id="sendChat"'));
check("ALVIS and Avatar display modes remain separate", app.includes('id="jarvisModeButton"') && app.includes('id="avatarModeButton"') && app.includes('id="alvisAvatarCanvas"'));
check("encrypted memory, history, synchronization, backup and Kokoro code remain", app.includes("encryptData") && app.includes("data.history") && app.includes("saveCloudCore") && app.toLowerCase().includes("backup") && app.includes("Kokoro"));
check("the v292 app shell activates with only login-critical assets and caches app assets on demand", sw.includes('alvis-cache-v327-integrated') && sw.includes("REQUIRED_FILES_TO_CACHE") && sw.includes("url.origin === self.location.origin") && sw.includes("cache.put(cacheRequest, response.clone())"));
check("the diagnostic distinguishes the page build, controlling Worker, and registered active Worker", app.includes('const ALVIS_APP_BUILD_ID="v327"') && app.includes("ALVIS_GET_BUILD_INFO") && sw.includes("ALVIS_GET_BUILD_INFO") && app.includes("現在この画面を制御するWorker版") && app.includes("登録済みactive Worker版"));
check("self-directed goal proposals reject exact repeats before filling the editable task draft", app.includes("findDuplicateAutonomyTask(data.autonomyTasks,proposal.goal,proposal.firstAction)") && app.includes("buildAutonomyDuplicateRetryPrompt(promptText,repeatedTask)") && app.includes("別案を1回再提案しましたが") && app.includes('id="autonomyCycleButton"'));
check("autonomy issue scans deduplicate the same normalized title and next action while allowing a different experiment", app.includes("function findDuplicateAutonomyIssue(issues,candidate)") && app.includes("findDuplicateAutonomyIssue(data.autonomyIssues,item)") && app.includes("findDuplicateAutonomyIssue(unique,item)") && app.includes("normalizeAutonomyTaskText(issue?.nextAction)"));
check("autonomy retrospectives do not add duplicate learning text and next experiments or change existing approval", app.includes("function findDuplicateAutonomyLearning(learnings,candidate)") && app.includes("findDuplicateAutonomyLearning(data.learnings,learningCandidate)") && app.includes("if(duplicateLearningIndex===-1)data.learnings.push(learningCandidate)") && app.includes("既存メモの承認状態は変更していません"));
check("autonomy priority plan ranks unresolved issues by score and excludes dismissed/adopted/duplicate issues", app.includes("function buildAutonomyPriorityPlan(issues,tasks)") && app.includes("b.score-a.score||a.originalIndex-b.originalIndex") && app.includes("item.status!==\"dismissed\"&&item.status!==\"adopted\"&&!item.duplicateTask") && app.includes("ALVISが計算した改善優先順位：") && app.includes("原則として1位の課題"));
check("autonomy task review records optional baseline and compares before/after evidence without inventing results", app.includes("開始前の状態：") && app.includes("開始前後の比較：") && app.includes('"開始前の状態："+(task.baselineNote||"未記録（比較不可）")') && app.includes("comparison:String(parsed.comparison||\"\").trim().slice(0,500)") && app.includes("開始前の情報がない場合は比較不能と明記"));
check("autonomy issue cards track linked task progress and show the latest evidence-based retrospective", app.includes("function summarizeAutonomyIssueProgress(issue,tasks)") && app.includes("sourceIssueKey") && app.includes("関連タスク：") && app.includes("最新の評価：") && app.includes("確認した根拠：") && app.includes('completed.filter(task=>task?.retrospective&&typeof task.retrospective==="object")'));
check("autonomy issue scoring uses bounded weighted dimensions and deterministic priority thresholds", app.includes("function scoreAutonomyIssue(item)") && app.includes("scores.impact*3+scores.urgency*2+scores.benefit*3") && app.includes("score>=75?\"high\":score>=50?\"medium\":\"low\"") && app.includes("優先スコア：") && app.includes("repeatRisk"));
check("autonomy goal selection derives evidence-weighted guidance from completed retrospectives without promoting unreviewed work", app.includes("function buildAutonomyDecisionEvidence(tasks)") && app.includes("const decisionEvidence=buildAutonomyDecisionEvidence(data.autonomyTasks)") && app.includes("過去の実験結果から作った判断材料") && app.includes("unclearまたは未振り返りは成功・失敗と断定せず") && app.includes("reviewedCount:reviewed.length"));
check("self-directed goal generation retries a duplicate only once using the prior task result", app.includes("function buildAutonomyDuplicateRetryPrompt(promptText,previousTask)") && app.includes("const retryPrompt=buildAutonomyDuplicateRetryPrompt(promptText,repeatedTask)") && app.includes("別案を1回再提案しましたが") && app.includes("retrospective:previousTask?.retrospective||null"));
check("the device diagnostic has a one-tap copy action with a Safari fallback", app.includes('id="copyDeviceDiagnostics"') && app.includes("navigator.clipboard.writeText(textToCopy)") && app.includes('document.execCommand("copy")'));
check("the diagnostic separates all ALVIS app caches from the caches reported by live Workers without deleting any cache", app.includes("ALVISアプリキャッシュ一覧") && app.includes("制御中Workerのキャッシュ") && app.includes("登録済みactive Workerのキャッシュ") && app.includes("現Worker以外のALVISキャッシュ") && !app.includes("caches.delete("));
check("Service Worker update starts after the initial page scripts", app.indexOf("function waitForAlvisServiceWorkerActivation") > app.indexOf("updateHudClock();") && app.includes("alvisServiceWorkerReady=(async()=>{") && !app.includes("__alvisEarlyServiceWorkerReady"));
check("the independent dependency cache remains separate", sw.includes('const DEPENDENCY_CACHE_NAME = "alvis-deps-v2"') && sw.includes('key.startsWith("alvis-deps-")'));
check("the on-device startup diagnostic measures the real integrated login screen", startupCheck.includes('frame.src="./index-integrated.html?startup-check="') && startupCheck.includes('getElementById("lockPanel")') && startupCheck.includes("loginVisibleMs"));
check("the startup diagnostic reports worker/cache versions without reading user data", startupCheck.includes("sw.controller") && startupCheck.includes('caches.keys()') && !startupCheck.includes("indexedDB.open") && !startupCheck.includes("localStorage.getItem"));
console.log(checks.map(name => "PASS " + name).join("\n"));
console.log(checks.length + "/" + checks.length + " dashboard-image checks passed.");
