import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { chromium, webkit } from "playwright";

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
const externalRequests = [];
let trackExternalRequests = false;
page.on("pageerror", error => pageErrors.push({ message: error.message, stack: error.stack || "" }));
page.on("request", request => {
  if (!trackExternalRequests) return;
  const requestUrl = new URL(request.url());
  if (requestUrl.origin !== new URL(avatarUrl).origin) externalRequests.push(request.url());
});

try {
  // Register/activate the existing ALVIS worker from the app shell first.
  const shellResponse = await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  assert.ok(shellResponse?.ok(), "ALVIS app shell must return HTTP 200 before offline avatar checks");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 });
  trackExternalRequests = true;
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
  for (const [id, value] of [["smile","0.65"],["sad","0.2"],["angry","0.15"],["surprised","0.1"],["relaxed","0.25"],["aa","0.7"],["ih","0.2"],["ou","0.3"],["ee","0.4"],["oh","0.5"],["blink","0.35"],["blinkLeft","0.8"],["blinkRight","0.6"]]) {
    await page.locator("#"+id).evaluate((element, next) => {
      element.value = next;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    assert.equal(await page.locator("#"+id+"Value").evaluate(element => element.value), Number(value).toFixed(2), id+" slider must update its value output");
  }
  for (const id of ["front","rightAngle","rightProfile","back","leftAngle","leftProfile"]) {
    await page.locator("#"+id).click();
    assert.ok(await page.locator("#stage canvas").count()===1, "Avatar Studio view preset must keep the live 3D canvas: "+id);
  }
  await page.locator("#front").click();
  await page.waitForTimeout(180);
  const frontViewPixels=await page.locator("#stage canvas").screenshot();
  await page.locator("#rightProfile").click();
  await page.waitForTimeout(180);
  const profileViewPixels=await page.locator("#stage canvas").screenshot();
  assert.ok(!frontViewPixels.equals(profileViewPixels), "front and profile camera presets must produce different 3D views");
  const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
  await page.locator("#export").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "alvis-face-prototype.vrm", "export must use the expected VRM filename");
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
  const triangleCount=(gltf.meshes||[]).reduce((sum,mesh)=>sum+(mesh.primitives||[]).reduce((subtotal,primitive)=>{
    const count=primitive.indices!==undefined?gltf.accessors[primitive.indices]?.count:gltf.accessors[primitive.attributes.POSITION]?.count;
    return subtotal+(count||0)/(primitive.indices!==undefined?3:3);
  },0),0);
  assert.ok(triangleCount>0&&triangleCount<75000,"VRM must stay below the 75k-triangle mobile performance budget; got "+triangleCount);
  console.log("PASS mobile geometry budget: "+triangleCount+" triangles");

  assert.ok((gltf.images||[]).length>0 && (gltf.textures||[]).length>0, "VRM must embed its locally generated skin texture");
  assert.ok((gltf.materials||[]).some(material=>material.pbrMetallicRoughness?.baseColorTexture?.index!==undefined), "VRM must assign the skin base-color texture to a PBR material");
  const skinMaterials=(gltf.materials||[]).filter(material=>material.pbrMetallicRoughness?.baseColorTexture?.index!==undefined);
  assert.ok(skinMaterials.some(material=>material.normalTexture?.index!==undefined), "VRM must export the generated skin tangent-space normal map");
  assert.ok(skinMaterials.some(material=>material.pbrMetallicRoughness?.metallicRoughnessTexture?.index!==undefined), "VRM must export the generated skin roughness map through the metallic-roughness texture");

  for (const name of ["blink","blinkLeft","blinkRight","happy","sad","angry","surprised","relaxed","aa","ih","ou","ee","oh","lookUp","lookDown","lookLeft","lookRight"]) {
    assert.ok(targetNames.includes(name), "VRM must retain named morph target: "+name+"; found "+targetNames.join(", "));
  }
  const vrmExtension = gltf.extensions?.VRMC_vrm;
  assert.ok(vrmExtension, "export must include VRMC_vrm extension");
  assert.equal(vrmExtension.meta?.avatarPermission,"onlyAuthor","personal ALVIS avatar must be marked for author-only use");
  assert.equal(vrmExtension.meta?.allowRedistribution,false,"personal ALVIS avatar must not permit redistribution");
  for (const nodeName of ["shoulder-left","shoulder-right","upper-arm-left","upper-arm-right"]) assert.ok(gltf.nodes.some(node=>node.name===nodeName),"VRM must include chest-attached upper-body geometry: "+nodeName);
  for (let strand=0;strand<5;strand++) assert.ok(gltf.nodes.some(node=>node.name==="hair-fringe-strand-"+strand),"VRM must preserve swept fringe strand "+strand);
  for (const nodeName of ["nostril-left","nostril-right"]) assert.ok(gltf.nodes.some(node=>node.name===nodeName),"VRM must preserve sculpted nose detail: "+nodeName);
  for (const nodeName of ["upper-eyelid-crease-left","upper-eyelid-crease-right","eye-inner-canthus-left","eye-inner-canthus-right","eye-outer-canthus-left","eye-outer-canthus-right"]) assert.ok(gltf.nodes.some(node=>node.name===nodeName),"VRM must preserve refined eye contour detail: "+nodeName);
  for (const nodeName of ["lower-eyelid-waterline-left","lower-eyelid-waterline-right"]) assert.ok(gltf.nodes.some(node=>node.name===nodeName),"VRM must preserve lower eyelid waterlines: "+nodeName);
  assert.ok(gltf.nodes.some(node=>node.name==="facial-skull"),"VRM must preserve refined facial skull geometry");
  for (const [meshName,boneName] of [["upper-arm-left","leftUpperArm"],["upper-arm-right","rightUpperArm"]]) {
    const meshIndex=gltf.nodes.findIndex(node=>node.name===meshName),boneIndex=gltf.nodes.findIndex(node=>node.name===boneName);
    assert.ok(meshIndex>=0&&boneIndex>=0&&gltf.nodes[boneIndex].children?.includes(meshIndex),"upper-arm mesh must be parented to its matching humanoid bone: "+meshName);
  }
  assert.equal(vrmExtension.specVersion, "1.0", "export must declare VRM 1.0");
  assert.ok(gltf.extensionsRequired?.includes("VRMC_vrm"), "VRMC_vrm must be required");
  assert.equal(vrmExtension.lookAt?.type, "expression", "VRM lookAt must use expression mode");
  for (const key of ["rangeMapHorizontalInner","rangeMapHorizontalOuter","rangeMapVerticalDown","rangeMapVerticalUp"]) assert.equal(vrmExtension.lookAt[key]?.outputScale, 1, "lookAt range map must use normalized expression weights: "+key);
  const humanBones = vrmExtension.humanoid?.humanBones || {};
  for (const bone of ["hips","spine","head","leftUpperLeg","leftLowerLeg","leftFoot","rightUpperLeg","rightLowerLeg","rightFoot","leftUpperArm","leftLowerArm","leftHand","rightUpperArm","rightLowerArm","rightHand"]) {
    assert.ok(Number.isInteger(humanBones[bone]?.node), "VRM required humanoid bone must map to a node: "+bone);
    assert.ok(gltf.nodes[humanBones[bone].node], "VRM bone node must exist: "+bone);
  }
  for (const expression of ["blink","blinkLeft","blinkRight","happy","sad","angry","surprised","relaxed","aa","ih","ou","ee","oh","lookUp","lookDown","lookLeft","lookRight"]) {
    const binds = vrmExtension.expressions?.preset?.[expression]?.morphTargetBinds || [];
    assert.ok(binds.length > 0, "VRM preset must have morph target binds: "+expression);
    for (const bind of binds) {
      assert.ok(gltf.nodes[bind.node]?.mesh !== undefined, "expression bind must point to a mesh node: "+expression);
      const targetCount = gltf.meshes[gltf.nodes[bind.node].mesh].primitives[0].targets?.length || 0;
      assert.ok(bind.index >= 0 && bind.index < targetCount, "expression bind index must exist: "+expression);
      assert.equal(bind.weight, 1, "expression bind must use full normalized weight: "+expression);
    }
  }
  const blinkBindNodeNames = expression => (vrmExtension.expressions?.preset?.[expression]?.morphTargetBinds||[]).map(bind=>gltf.nodes[bind.node]?.name).filter(Boolean).sort();
  assert.deepEqual(blinkBindNodeNames("blink"),["eyelid-left","eyelid-right"],"full blink must affect both eyelids");
  assert.deepEqual(blinkBindNodeNames("blinkLeft"),["eyelid-left"],"left wink must affect only the left eyelid");
  assert.deepEqual(blinkBindNodeNames("blinkRight"),["eyelid-right"],"right wink must affect only the right eyelid");
  assert.deepEqual(pageErrors, [], "Avatar Studio must not throw browser runtime errors");
  assert.deepEqual(externalRequests, [], "Avatar Studio must load Three.js and all modules from the same origin only");

  // Validate the exported .vrm with the exact VRM loader used by ALVIS itself.
  trackExternalRequests = false;
  const appResponse = await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  assert.ok(appResponse?.ok(), "ALVIS runtime page must return HTTP 200 for VRM loader validation");
  const runtimeDiagnostics = await page.evaluate(async (base64) => {
    const runtime = await import("./assets/alvis-vrm-runtime.js");
    const binary = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const host = document.createElement("div");
    Object.assign(host.style, { position:"fixed", left:"0", top:"0", width:"420px", height:"520px", opacity:"0.02", pointerEvents:"none" });
    document.body.appendChild(host);
    let mounted;
    try {
      mounted = await runtime.mountVrmAvatar(host, new Blob([binary], { type:"model/gltf-binary" }));
      const canvas = host.querySelector("canvas");
      const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
      const diagnostics = mounted.getDiagnostics();
      mounted.setIdleEnabled(true);
      const chestBone = mounted.vrm.humanoid?.getNormalizedBoneNode?.("chest");
      const chestBefore = chestBone?.position?.y ?? 0;
      const actions = {
        manualLookAt: mounted.setLookAt(0, 1, 3),
        automaticLookAt: mounted.setAutoLookAt(true),
        happyExpression: mounted.setExpression("happy", 0.5),
        happyEmotion: mounted.setEmotion("happy", 0.5),
        vowelViseme: mounted.setMouthViseme("aa", 0.7),
        headGesture: mounted.setHeadGesture("nod")
      };
      const render = { canvas:!!canvas, webgl:!!gl, width:canvas?.width||0, height:canvas?.height||0 };
      await new Promise(resolve=>setTimeout(resolve,1500));
      const chestAfter = chestBone?.position?.y ?? chestBefore;
      const studioLink=document.querySelector("#alvisAvatarStudioLink")?.getAttribute("href")||null;
      return { diagnostics, actions, render, chestDelta:chestAfter-chestBefore, studioLink };
    } finally {
      mounted?.dispose?.();
      host.remove();
    }
  }, buffer.toString("base64"));
  const diagnostics = runtimeDiagnostics.diagnostics;
  assert.equal(diagnostics.format, "VRM", "ALVIS runtime must parse the exported VRM");
  assert.ok(diagnostics.humanoidHead && diagnostics.humanoidNeck && diagnostics.headMotion, "ALVIS runtime must recognize humanoid head/neck bones");
  assert.ok(diagnostics.chestMotion, "ALVIS runtime must recognize chest bone for subtle breathing");
  assert.ok(diagnostics.lookAt, "ALVIS runtime must recognize VRM lookAt");
  assert.ok(diagnostics.blink, "ALVIS runtime must recognize blink");
  assert.ok(diagnostics.blinkLeft && diagnostics.blinkRight, "ALVIS runtime must recognize independent left/right blink expressions");
  for (const feature of ["happy","sad","angry","relaxed","surprised","aa","ih","ou","ee","oh"]) {
    assert.ok(diagnostics[feature], "ALVIS runtime must recognize VRM expression: "+feature);
  }
  for (const [action, result] of Object.entries(runtimeDiagnostics.actions)) assert.equal(result, true, "ALVIS runtime interaction must succeed: "+action);
  assert.ok(runtimeDiagnostics.render.canvas && runtimeDiagnostics.render.webgl && runtimeDiagnostics.render.width > 0 && runtimeDiagnostics.render.height > 0, "ALVIS runtime must render the VRM to a live WebGL canvas");
  assert.ok(Math.abs(runtimeDiagnostics.chestDelta)>0.0005, "ALVIS runtime must apply a visible low-amplitude chest breathing motion");
  assert.equal(runtimeDiagnostics.studioLink,"./tools/avatar-studio.html","ALVIS avatar mode must link to the local Avatar Studio");
  assert.deepEqual(pageErrors, [], "ALVIS VRM runtime must not throw browser errors");
  console.log("PASS existing ALVIS VRM runtime parsed, rendered, and controlled the exported file: "+JSON.stringify(runtimeDiagnostics));

  const cachedAvatarResponse = await page.goto(avatarUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert.ok(cachedAvatarResponse?.ok(), "Avatar Studio must reopen before the offline cache check");
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker?.controller), "Avatar Studio must be controlled by the ALVIS service worker");
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#stage canvas", { timeout: 60000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#stage canvas");
    if (!canvas) return false;
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return !!gl && canvas.width > 0 && canvas.height > 0;
  }, null, { timeout: 30000 });
  assert.deepEqual(pageErrors, [], "Avatar Studio must reopen from the ALVIS cache without browser runtime errors");
  console.log("PASS Avatar Studio HTTP response");
  console.log("PASS no external CDN requests from Avatar Studio");
  console.log("PASS offline reload through the ALVIS service worker cache");
  console.log("PASS real WebGL renderer: "+JSON.stringify(renderInfo));
  console.log("PASS expression and five Japanese vowel viseme controls");
  console.log("PASS VRM 1.0 binary download: "+fileInfo.size+" bytes");
  console.log("PASS VRMC_vrm extension, humanoid bones, lookAt range maps, and expression morph binds");
} finally {
  await context.close();
  await browser.close();
}

const safariBrowser = await webkit.launch({ headless: true });
const safariContext = await safariBrowser.newContext({ acceptDownloads: true, viewport: { width: 900, height: 900 } });
const safariPage = await safariContext.newPage();
safariPage.setDefaultTimeout(30000);
const safariErrors = [];
const safariExternalRequests = [];
let trackSafariAvatarRequests = true;
safariPage.on("pageerror", error => safariErrors.push({ message:error.message, stack:error.stack||"" }));
safariPage.on("request", request => {
  if (!trackSafariAvatarRequests) return;
  const requestUrl = new URL(request.url());
  if (requestUrl.origin !== new URL(avatarUrl).origin) safariExternalRequests.push(request.url());
});
try {
  const response = await safariPage.goto(avatarUrl, { waitUntil:"domcontentloaded", timeout:120000 });
  assert.ok(response?.ok(), "WebKit must load Avatar Studio");
  await safariPage.waitForSelector("#stage canvas", { timeout:60000 });
  await safariPage.waitForFunction(() => {
    const canvas=document.querySelector("#stage canvas");
    if(!canvas)return false;
    const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
    return !!gl&&canvas.width>0&&canvas.height>0;
  }, null, { timeout:30000 });
  const safariRender = await safariPage.locator("#stage canvas").evaluate(canvas => {
    const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");
    return {width:canvas.width,height:canvas.height,version:gl.getParameter(gl.VERSION)};
  });
  for (const [id,value] of [["blinkLeft","0.75"],["blinkRight","0.4"],["smile","0.3"],["aa","0.6"]]) {
    await safariPage.locator("#"+id).evaluate((element,next)=>{
      element.value=next;element.dispatchEvent(new Event("input",{bubbles:true}));
    },value);
    assert.equal(await safariPage.locator("#"+id+"Value").evaluate(element=>element.value),Number(value).toFixed(2), "WebKit "+id+" control must respond");
  }
  const safariDownloadPromise=safariPage.waitForEvent("download",{timeout:60000});
  await safariPage.locator("#export").click();
  const safariDownload=await safariDownloadPromise;
  const safariPath=await safariDownload.path();
  assert.ok(safariPath,"WebKit must export a VRM file");
  const safariBuffer=await readFile(safariPath);
  assert.equal(safariBuffer.toString("ascii",0,4),"glTF","WebKit VRM output must be a GLB binary");
  trackSafariAvatarRequests=false;
  const safariRuntimeResponse=await safariPage.goto(previewUrl,{waitUntil:"domcontentloaded",timeout:120000});
  assert.ok(safariRuntimeResponse?.ok(),"WebKit must load the ALVIS runtime page");
  const safariRuntime=await safariPage.evaluate(async base64=>{
    const runtime=await import("./assets/alvis-vrm-runtime.js");
    const binary=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const host=document.createElement("div");
    Object.assign(host.style,{position:"fixed",left:"0",top:"0",width:"360px",height:"460px",opacity:"0.02",pointerEvents:"none"});
    document.body.appendChild(host);
    let mounted;
    try{
      mounted=await runtime.mountVrmAvatar(host,new Blob([binary],{type:"model/gltf-binary"}));
      const diagnostics=mounted.getDiagnostics();
      const actions={leftWink:mounted.setExpression("blinkLeft",0.7),rightWink:mounted.setExpression("blinkRight",0.6),look:mounted.setLookAt(0,1,3)};
      const canvas=host.querySelector("canvas");
      const studioLink=document.querySelector("#alvisAvatarStudioLink")?.getAttribute("href")||null;
      return {diagnostics,actions,render:!!canvas&&(!!canvas.getContext("webgl2")||!!canvas.getContext("webgl")),studioLink};
    }finally{mounted?.dispose?.();host.remove();}
  },safariBuffer.toString("base64"));
  assert.equal(safariRuntime.diagnostics.format,"VRM","WebKit ALVIS runtime must parse VRM 1.0");
  assert.ok(safariRuntime.diagnostics.blinkLeft&&safariRuntime.diagnostics.blinkRight,"WebKit runtime must recognize split blink expressions");
  assert.ok(safariRuntime.diagnostics.chestMotion,"WebKit runtime must recognize chest motion");
  assert.ok(Object.values(safariRuntime.actions).every(Boolean),"WebKit runtime must control wink and gaze expressions");
  assert.ok(safariRuntime.render,"WebKit runtime must render the VRM");
  assert.equal(safariRuntime.studioLink,"./tools/avatar-studio.html","WebKit ALVIS page must expose the local Avatar Studio entry");
  assert.deepEqual(safariErrors,[],"WebKit Avatar Studio and runtime must not throw browser errors");
  assert.deepEqual(safariExternalRequests,[],"WebKit Avatar Studio must not request external assets");
  console.log("PASS WebKit Avatar Studio rendering, independent wink controls, VRM export and ALVIS runtime import: "+JSON.stringify({safariRender,safariRuntime}));
} finally {
  await safariContext.close();
  await safariBrowser.close();
}
