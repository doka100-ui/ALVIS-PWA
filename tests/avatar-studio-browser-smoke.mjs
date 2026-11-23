import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { chromium } from "playwright";

const previewUrl = process.env.ALVIS_PREVIEW_URL;
assert.ok(previewUrl, "ALVIS_PREVIEW_URL must point to this commit's Cloudflare Pages preview");
const avatarUrl = new URL("tools/avatar-studio.html", previewUrl).href;
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader"
  ]
});
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const pageErrors = [];
const failedRequests = [];
page.on("pageerror", error => pageErrors.push(error.message));
page.on("requestfailed", request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "" }));

try {
  const response = await page.goto(avatarUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  assert.ok(response?.ok(), "Avatar Studio must return HTTP 200: " + avatarUrl);
  await page.waitForSelector("#stage canvas", { timeout: 60000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#stage canvas");
    if (!canvas) return false;
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return !!gl && canvas.width > 0 && canvas.height > 0;
  }, null, { timeout: 30000 });
  const renderInfo = await page.locator("#stage canvas").evaluate(canvas => {
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      width: canvas.width,
      height: canvas.height,
      version: gl.getParameter(gl.VERSION),
      renderer: gl.getParameter(gl.RENDERER)
    };
  });
  assert.ok(renderInfo.width > 0 && renderInfo.height > 0, "WebGL canvas must have a real drawing buffer");
  assert.ok(renderInfo.version.includes("WebGL"), "WebGL context must be active");
  assert.equal(await page.locator("#smile").count(), 1, "happy expression slider must exist");
  for (const [id, value] of [["smile","0.65"],["sad","0.2"],["angry","0.15"],["surprised","0.1"],["aa","0.7"],["ih","0.2"],["ou","0.3"],["ee","0.4"],["oh","0.5"],["blink","0.35"]]) {
    await page.locator("#"+id).evaluate((element, next) => {
      element.value = next;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    assert.equal(await page.locator("#"+id+"Value").evaluate(element => element.value), Number(value).toFixed(2), id+" slider must update its value output");
  }
  const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
  await page.locator("#export").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "alvis-face-prototype.glb", "export must use the expected GLB filename");
  const filePath = await download.path();
  assert.ok(filePath, "GLB download must produce a file");
  const [buffer, fileInfo] = await Promise.all([readFile(filePath), stat(filePath)]);
  assert.ok(fileInfo.size > 1000, "GLB must contain a non-empty 3D scene");
  assert.equal(buffer.toString("ascii", 0, 4), "glTF", "download must be a binary glTF file");
  assert.equal(buffer.readUInt32LE(4), 2, "GLB version must be 2");
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  assert.equal(jsonType, 0x4e4f534a, "GLB first chunk must be JSON");
  const gltf = JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).trim());
  const targetNames = (gltf.meshes || []).flatMap(mesh => mesh.extras?.targetNames || []);
  for (const name of ["blink","happy","sad","angry","surprised","aa","ih","ou","ee","oh"]) {
    assert.ok(targetNames.includes(name), "GLB must retain named morph target: "+name+"; found "+targetNames.join(", "));
  }
  assert.deepEqual(pageErrors, [], "Avatar Studio must not throw browser runtime errors");
  console.log("PASS Avatar Studio HTTP response");
  console.log("PASS real WebGL renderer: "+JSON.stringify(renderInfo));
  console.log("PASS expression and five Japanese vowel viseme controls");
  console.log("PASS GLB binary download: "+fileInfo.size+" bytes");
  console.log("PASS exported GLB contains blink, emotion, and vowel morph target names");
} finally {
  await context.close();
  await browser.close();
}
