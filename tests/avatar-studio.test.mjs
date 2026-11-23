import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const html = await readFile(new URL("../tools/avatar-studio.html", import.meta.url), "utf8");
const check = (name, value) => { assert.ok(value, name); console.log("PASS", name); };
check("standalone mobile page is present", html.includes('<meta name="viewport"'));
check("Three.js is used for a real WebGL scene", html.includes("new THREE.WebGLRenderer") && html.includes("new THREE.Scene"));
check("touch orbit controls are enabled", html.includes("OrbitControls") && html.includes("controls.enableDamping=true"));
check("six face-shape controls are present", ["faceWidth","faceLength","eyeSize","eyeSpacing","noseSize","mouthSize"].every(id => html.includes('id="'+id+'"')));
check("blink and smile preview controls are present", ["blink","smile"].every(id => html.includes('id="'+id+'"')));
check("blink controls independent eyelid meshes", html.includes('name=side<0?"eyelid-left":"eyelid-right"') && html.includes("leftLid.morphTargetInfluences[0]=values.blink") && html.includes("rightLid.morphTargetInfluences[0]=values.blink"));
check("eyelids contain exported blink and side-specific morph targets", html.includes('lidGeometry.userData.targetNames=["blink",sideBlink]') && html.includes("lidGeometry.morphAttributes.position=[lidClosed,lidClosed.clone()]"));
check("upper lip contains five named expression morph targets", html.includes('lipGeometry.userData.targetNames=["happy","sad","angry","surprised","relaxed"]') && html.includes("lipGeometry.morphAttributes.position=lipTargets"));
check("smile preview drives the happy morph target", html.includes("upperLip.morphTargetInfluences[0]=values.smile"));
check("GLB morph targets have explicit semantic names", html.includes("lid.morphTargetDictionary={blink:0,[sideBlink]:1}") && html.includes("upperLip.morphTargetDictionary={happy:0,sad:1,angry:2,surprised:3,relaxed:4}"));
check("five named mouth expression targets are exported", html.includes('upperLip.morphTargetDictionary={happy:0,sad:1,angry:2,surprised:3,relaxed:4}') && html.includes('id="smile"') && ["sad","angry","surprised","relaxed"].every(name=>html.includes('id="'+name+'"')));
check("eyebrows have named angry sad and surprised morph targets", html.includes("addBrowMorphTargets(brow,side)") && html.includes("mesh.updateMorphTargets()") && html.includes('mesh.morphTargetDictionary={angry:0,sad:1,surprised:2}'));
check("mouth interior exports all five VRM vowel visemes", html.includes('mouthInterior.morphTargetDictionary={aa:0,ih:1,ou:2,ee:3,oh:4}') && ["aa","ih","ou","ee","oh"].every(name=>html.includes('id="'+name+'"')));
check("lip and mouth-interior morph target name counts match their geometry targets", html.includes('lipGeometry.userData.targetNames=["happy","sad","angry","surprised","relaxed"]') && html.includes("mouthInteriorGeometry.userData.targetNames=Object.keys(visemeScales)"));
check("all five vowel sliders are included in rebuild state", html.includes('"surprised","relaxed","aa","ih","ou","ee","oh"];') && html.includes("mouthInterior.morphTargetInfluences[index]=values[name]"));
check("viseme preview sliders drive the mouth interior targets", html.includes('mouthInterior.morphTargetInfluences[index]=values[name]') && html.includes('name="mouth-viseme-interior"'));
check("lower lip has matching five vowel morph targets", html.includes('lowerLip.morphTargetDictionary={aa:0,ih:1,ou:2,ee:3,oh:4}') && html.includes('lowerLip.morphTargetInfluences[index]=values[name]'));
check("lower lip target metadata has exactly five vowel names", html.includes('lowerLipGeometry.userData.targetNames=["aa","ih","ou","ee","oh"]') && html.includes("lowerLipGeometry.morphAttributes.position=lowerLipTargets"));
check("expression sliders also drive eyebrow shape targets", html.includes('brow.morphTargetInfluences[0]=values.angry') && html.includes('brow.morphTargetInfluences[1]=values.sad') && html.includes('brow.morphTargetInfluences[2]=values.surprised'));
check("expression sliders drive independent morph influences", ["values.smile","values.sad","values.angry","values.surprised","values.relaxed"].every(value=>html.includes("upperLip.morphTargetInfluences") && html.includes(value)));
check("render loop fully pauses while the page is hidden", html.includes("cancelAnimationFrame(frameId)") && html.includes("setRenderActive(document.visibilityState===\"visible\")"));
check("GLB export is implemented", html.includes("GLTFExporter") && html.includes("parseAsync(root") && html.includes('type:"model/gltf-binary"'));
check("no image upload or remote inference endpoint is present", !/FormData|XMLHttpRequest|fetch\s*\(|https?:\/\/[^"'\s]+\/(?:api|upload|generate)/i.test(html));
const vendorPaths = ["../tools/vendor/three.core.js","../tools/vendor/three.module.js","../tools/vendor/controls/OrbitControls.js","../tools/vendor/exporters/GLTFExporter.js","../tools/vendor/THREE-LICENSE.txt"];
const vendorContents = await Promise.all(vendorPaths.map(path => readFile(new URL(path, import.meta.url), "utf8")));
check("Three.js modules are vendored locally with license", vendorContents.slice(0,4).every(content => content.length > 10000) && vendorContents[4].includes("MIT License"));
check("Avatar Studio import map has no external CDN dependency", html.includes('"three":"./vendor/three.module.js"') && html.includes('"three/addons/":"./vendor/"') && !html.includes("cdn.jsdelivr.net"));
check("face rebuild disposes replaced geometries", html.includes("o.geometry.dispose()"));
const faceBuilder = html.slice(html.indexOf("function makeFace()"), html.indexOf("makeFace();"));
check("shared eye and brow materials are declared", html.includes("eyeGlint=mat(0xffffff,.2)") && html.includes("browMat=mat(0x493a36,.8)"));
check("facial features use independent transform groups", ["facial-eyes","facial-nose","facial-mouth"].every(name => html.includes('name="'+name+'"')));
check("face controls modify only their intended feature groups", html.includes('getObjectByName("facial-eyes")') && html.includes('getObjectByName("facial-nose")') && html.includes('getObjectByName("facial-mouth")'));
check("bob hairstyle has a distinct rear volume and crown", html.includes('name="hair-rear-bob"') && html.includes('name="hair-crown"'));
check("swept fringe includes separate curved strand geometry", (html.match(/curve\(faceGroup,/g)||[]).length >= 6 && html.includes('name="hair-swept-fringe"'));
check("side hair has independent left/right locks", html.includes('name=side<0?"hair-side-left":"hair-side-right"'));
check("necklace pendant and barcode-style neck details are modeled", html.includes('name="necklace-pendant"') && html.includes('name="neck-mark-"+index'));
check("jaw and cheek profile receives vertex sculpting", html.includes("const cheek=1+.055") && html.includes("const taper=.78+.22"));
const moduleScript = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].at(-1)?.[1];
assert.ok(moduleScript, "module script exists");
const syntax = spawnSync(process.execPath, ["--check", "--input-type=module"], { input: moduleScript, encoding: "utf8" });
assert.equal(syntax.status, 0, syntax.stderr || "avatar studio module syntax check failed");
console.log("PASS module JavaScript syntax");

check("VRM 1.0 extension packaging is implemented", html.includes("attachVrm10Extension") && html.includes('specVersion:"1.0"'));
check("VRM required humanoid bones are created", ["hips","spine","head","leftUpperLeg","leftLowerLeg","leftFoot","rightUpperLeg","rightLowerLeg","rightFoot","leftUpperArm","leftLowerArm","leftHand","rightUpperArm","rightLowerArm","rightHand"].every(name=>html.includes('"'+name+'"')));
check("visible face and torso geometry are rigidly attached to head and chest bones", html.includes("torsoNames.has(part.name)?chest:headBone"));
check("VRM extension is declared as used and required", html.includes('gltf.extensionsRequired=[...new Set') && html.includes('"VRMC_vrm"'));
check("VRM expression presets are generated from actual mesh target names", html.includes("expressions.preset[preset]={morphTargetBinds}") && html.includes("names.forEach((name,index)"));

check("both eyes export named VRM look-at morph targets", html.includes("addEyeGazeMorphTargets(irisMesh)") && html.includes("addEyeGazeMorphTargets(pupilMesh)") && html.includes('mesh.morphTargetDictionary={lookUp:0,lookDown:1,lookLeft:2,lookRight:3}'));
check("VRM look-at expression presets and range maps are included", html.includes('lookAt:{type:"expression"') && ["lookUp","lookDown","lookLeft","lookRight"].every(name=>html.includes('"'+name+'"')));

check("VRM metadata permits personal use and local modification without redistribution", html.includes('avatarPermission:"everyone"') && html.includes('commercialUsage:"personalNonProfit"') && html.includes('allowRedistribution:false') && html.includes('modification:"allowModification"'));

const appHtml = await readFile(new URL("../index-integrated.html", import.meta.url), "utf8");
const vrmRuntimeSource = await readFile(new URL("../assets/alvis-vrm-runtime.js", import.meta.url), "utf8");
check("ALVIS VRM runtime dependencies resolve through the main app import map", appHtml.includes('"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/"') && appHtml.includes('"@pixiv/three-vrm": "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.5.5/lib/three-vrm.module.min.js"') && vrmRuntimeSource.includes('from "three/addons/loaders/GLTFLoader.js"'));

check("VRM runtime creates, tracks, and disposes an actual LookAt target", vrmRuntimeSource.includes("const lookAtTarget = vrm.lookAt ? new THREE.Object3D() : null;") && vrmRuntimeSource.includes("vrm.lookAt.target = lookAtTarget") && vrmRuntimeSource.includes("if (lookAtTarget) lookAtTarget.position.copy(avatarFocus)") && vrmRuntimeSource.includes("if (lookAtTarget) scene.remove(lookAtTarget)"));

check("procedural skin base-color and subtle pore texture are exported locally", html.includes("function makeSkinTexture()") && html.includes("skin.map=skinTexture") && html.includes("skin.bumpScale=.0025"));
check("eyes include iris rings, radial fibers, and individual lash strands", html.includes("iris-border-left") && html.includes("for(let ray=0;ray<14;ray++)") && html.includes("for(let lash=0;lash<4;lash++)"));
check("brows use the light taupe tone from the approved model sheet", html.includes("browMat=mat(0x927c69"));
check("nose and lips include fine anatomical contour details", html.includes("noseGroup") && html.includes("lipOutline") && html.includes("lipHighlight"));
check("bob includes independent fine hair strands on both sides", html.includes("for(let strand=0;strand<4;strand++)") && html.includes("hair-side-left") && html.includes("hair-side-right"));
check("white top includes shoulder straps, neckline and rib details", html.includes("tank-strap-left") && html.includes("tank-neckline") && html.includes("ribIndex"));
check("both single and independent left/right blink expressions are exported", html.includes('targetNames=["blink",sideBlink]') && html.includes('"blinkLeft","blinkRight"'));

check("left and right wink controls are exposed and connected to the matching eyelids", ["blinkLeft","blinkRight"].every(id=>html.includes('id="'+id+'"') && html.includes('values.'+id)) && html.includes('leftLid.morphTargetInfluences[1]=values.blinkLeft') && html.includes('rightLid.morphTargetInfluences[1]=values.blinkRight'));
