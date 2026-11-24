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
check("eyelids contain exported blink and side-specific morph targets", html.includes('lidGeometry.userData.targetNames=["blink",side<0?"blinkLeft":"blinkRight"]') && html.includes("lidGeometry.morphAttributes.position=[closedAttribute,new THREE.Float32BufferAttribute(lidClosedPositions.slice(),3)]") && html.includes("lidSegmentsX=24,lidSegmentsY=8"));
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
check("shared eye and brow materials are declared", html.includes("eyeGlint=mat(0xffffff,.2)") && html.includes("browMat=mat(0xa38a76,.82)"));
check("ears include named helix, antihelix, concha and tragus anatomy", ["ear-helix-left","ear-helix-right","ear-antihelix-left","ear-antihelix-right","ear-concha-left","ear-concha-right","ear-tragus-left","ear-tragus-right"].every(name=>html.includes(name)));
check("hair PBR textures are assigned only after both materials are initialized", html.indexOf("const skinShade=mat")>=0 && html.indexOf("hair.map=hairTextures.color")>html.indexOf("const skinShade=mat") && html.indexOf("hairLight.roughnessMap=hairTextures.roughness")>html.indexOf("const skinShade=mat"));
check("blonde hair receives deterministic local fiber color and roughness textures", html.includes("function makeHairTextures()") && html.includes("size=256,colorCanvas") && html.includes("hairTextures=makeHairTextures()") && html.includes("hair.map=hairTextures.color") && html.includes("hair.roughnessMap=hairTextures.roughness") && html.includes("hairLight.map=hairTextures.color"));
check("blonde hair uses subtle anisotropic fiber highlights", html.includes("anisotropy:.18") && html.includes("anisotropy:.24") && html.includes("anisotropyRotation:.12"));
check("blonde bob uses subtle physical sheen and clearcoat materials", html.includes("hair=new THREE.MeshPhysicalMaterial") && html.includes("sheen:.2") && html.includes("sheen:.24") && html.includes("sheenRoughness:.58") && html.includes("clearcoat:.12") && html.includes("hairLight=new THREE.MeshPhysicalMaterial"));
check("sclera iris and pupil use layered physical eye-surface materials", html.includes("sclera=new THREE.MeshPhysicalMaterial") && html.includes("clearcoat:.24") && html.includes("iris=new THREE.MeshPhysicalMaterial") && html.includes("clearcoat:.72") && html.includes("pupil=new THREE.MeshPhysicalMaterial") && html.includes("clearcoat:.82") && html.includes("almondEye(eyesGroup,sclera"));
check("upper eyelid crease and inner/outer eye corners are modeled on both sides", ["upper-eyelid-crease-left","upper-eyelid-crease-right","eye-inner-canthus-left","eye-inner-canthus-right","eye-outer-canthus-left","eye-outer-canthus-right"].every(name=>html.includes(name)));
check("subtle lower eyelid waterlines are modeled symmetrically", ["lower-eyelid-waterline-left","lower-eyelid-waterline-right"].every(name=>html.includes(name)));
check("facial features use independent transform groups", ["facial-eyes","facial-nose","facial-mouth"].every(name => html.includes('name="'+name+'"')));
check("face controls modify only their intended feature groups", html.includes('getObjectByName("facial-eyes")') && html.includes('getObjectByName("facial-nose")') && html.includes('getObjectByName("facial-mouth")'));
check("bob hairstyle has a distinct rear volume and crown", html.includes('name="hair-rear-bob"') && html.includes('name="hair-crown"'));
check("swept fringe includes separate curved strand geometry", (html.match(/curve\(faceGroup,/g)||[]).length >= 6 && html.includes('name="hair-swept-fringe"'));
check("three layered face-framing fringe ribbons are generated and named", html.includes('name="hair-face-framing-fringe-"+strand') && html.includes('strand<3') && html.includes('],.0095,strand===1?hairLight:hair'));
check("side hair has independent left/right locks", html.includes('name=side<0?"hair-side-left":"hair-side-right"'));
check("necklace pendant and barcode-style neck details are modeled", html.includes('name="necklace-pendant"') && html.includes('name="neck-mark-"+index'));
check("jaw and cheek profile receives refined continuous-surface sculpting", html.includes("const jaw=.76") && html.includes("const cheek=1+.055") && html.includes("const cheekbone=.026") && html.includes("const chin=.018") && html.includes("function makeContinuousHeadGeometry()"));
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

check("VRM metadata restricts this personal ALVIS avatar to its author and disables redistribution", html.includes('avatarPermission:"onlyAuthor"') && html.includes('commercialUsage:"personalNonProfit"') && html.includes('allowRedistribution:false') && html.includes('modification:"allowModification"'));

const appHtml = await readFile(new URL("../index-integrated.html", import.meta.url), "utf8");
const vrmRuntimeSource = await readFile(new URL("../assets/alvis-vrm-runtime.js", import.meta.url), "utf8");
check("ALVIS avatar mode links to the standalone local Avatar Studio without changing stored model data", appHtml.includes('id="alvisAvatarStudioLink"') && appHtml.includes('href="./tools/avatar-studio.html"') && appHtml.includes('target="_blank" rel="noopener noreferrer"') && appHtml.includes('id="alvisLoadGlbButton"'));
check("ALVIS VRM runtime dependencies resolve through the main app import map", appHtml.includes('"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/"') && appHtml.includes('"@pixiv/three-vrm": "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.5.5/lib/three-vrm.module.min.js"') && vrmRuntimeSource.includes('from "three/addons/loaders/GLTFLoader.js"'));

check("VRM runtime creates, tracks, and disposes an actual LookAt target", vrmRuntimeSource.includes("const lookAtTarget = vrm.lookAt ? new THREE.Object3D() : null;") && vrmRuntimeSource.includes("vrm.lookAt.target = lookAtTarget") && vrmRuntimeSource.includes("if (lookAtTarget) lookAtTarget.position.copy(avatarFocus)") && vrmRuntimeSource.includes("if (lookAtTarget) scene.remove(lookAtTarget)"));

check("procedural skin base-color, tangent normal detail, and roughness maps are generated locally for VRM export", html.includes("function makeSkinTextures()") && html.includes("skin.map=skinTextures.color") && html.includes("skin.normalMap=skinTextures.normal") && html.includes("skin.normalScale.set(.22,.22)") && html.includes("skin.roughnessMap=skinTextures.roughness") && html.includes("new THREE.CanvasTexture(normalCanvas)") && html.includes("new THREE.CanvasTexture(roughnessCanvas)"));
check("eyes include iris rings, radial fibers, and individual lash strands", html.includes("iris-border-left") && html.includes("for(let ray=0;ray<12;ray++)") && html.includes("ray*Math.PI*2/12") && html.includes("for(let lash=0;lash<4;lash++)"));
check("brows use the light taupe tone from the approved model sheet", html.includes("browMat=mat(0xa38a76"));
check("nose and lips include fine anatomical contour details", html.includes("noseGroup") && html.includes("lipOutline") && html.includes("lipHighlight"));
check("bob includes independent fine hair strands on both sides", html.includes("for(let strand=0;strand<4;strand++)") && html.includes("hair-side-left") && html.includes("hair-side-right"));
check("white top includes shoulder straps, neckline and rib details", html.includes("tank-strap-left") && html.includes("tank-neckline") && html.includes("ribIndex"));
check("both single and independent left/right blink expressions are exported", html.includes('targetNames=["blink",side<0?"blinkLeft":"blinkRight"]') && html.includes('"blinkLeft","blinkRight"'));

check("left and right wink controls are exposed and connected to the matching eyelids", ["blinkLeft","blinkRight"].every(id=>html.includes('id="'+id+'"') && html.includes('values.'+id)) && html.includes('leftLid.morphTargetInfluences[1]=values.blinkLeft') && html.includes('rightLid.morphTargetInfluences[1]=values.blinkRight'));

check("sclera uses a curved almond-shaped mesh instead of a spherical placeholder", html.includes("function almondEye(") && html.includes("new THREE.ShapeGeometry(shape,32)") && html.includes("vertices.setZ(i,.038*dome)") && html.includes("almondEye(eyesGroup,sclera,[x,.34,.675],.225,.105)"));

check("browser smoke exercises WebKit Avatar Studio and ALVIS VRM runtime", (await readFile(new URL("./avatar-studio-browser-smoke.mjs", import.meta.url), "utf8")).includes("webkit.launch") && (await readFile(new URL("./avatar-studio-browser-smoke.mjs", import.meta.url), "utf8")).includes("WebKit runtime must recognize split blink expressions"));

check("head is generated as a continuous anatomical surface with integrated nose relief", html.includes("function makeContinuousHeadGeometry()") && html.includes("const rows=72,segments=96") && html.includes("const jaw=.76") && html.includes("const noseBridge=.165") && html.includes("const noseTip=.112") && html.includes("geometry.setIndex(indices)") && html.includes("indices.push(a,a+1,b,b,a+1,b+1)") && html.includes("const geo=makeContinuousHeadGeometry()") && !html.includes("sculpted-nose-bridge-tip") && !html.includes("noseGeometry=new THREE.SphereGeometry"));

check("ALVIS model diagnostics report independent left/right wink support", appHtml.includes('"左右ウインク: "+mark(report?.blinkLeft&&report?.blinkRight)') && appHtml.includes('report.blinkLeft&&report.blinkRight&&"WINK"'));

check("face base includes refined cheekbone, jaw taper and chin projection sculpting", html.includes("const cheekbone=.038*Math.exp") && html.includes("const jawTaper=1-.045") && html.includes("const chin=.024*Math.exp") && html.includes("x*taper*cheek*jawTaper") && html.includes("z*depth+cheekbone+chin"));

check("eyelid blink target closes from the upper lid edge across the almond eye", html.includes("openEdge=.095*shape,closedEdge=-.095*shape") && html.includes("lidClosedPositions.push(localX,top+(closedEdge-top)*t,z)") && html.includes("lidGeometry.computeVertexNormals()"));

check("Avatar Studio provides six named inspection views around the 3D bust", ["front","rightAngle","rightProfile","back","leftAngle","leftProfile"].every(id=>html.includes('id="'+id+'"') && html.includes(id+":[") ) && html.includes("function setAvatarView(name)"));

check("VRM runtime exposes subtle chest breathing for rigs with a chest bone", (await readFile(new URL("../assets/alvis-vrm-runtime.js", import.meta.url), "utf8")).includes("Math.sin(elapsed * 0.92) * 0.003") && (await readFile(new URL("../assets/alvis-vrm-runtime.js", import.meta.url), "utf8")).includes("chestMotion: !!chestBone") && appHtml.includes('report.chestMotion&&"BREATHING"'));

check("browser smoke measures chest-bone motion rather than only checking for a chest node", (await readFile(new URL("./avatar-studio-browser-smoke.mjs", import.meta.url), "utf8")).includes("chestDelta") && (await readFile(new URL("./avatar-studio-browser-smoke.mjs", import.meta.url), "utf8")).includes("low-amplitude chest breathing motion"));

check("bob hair includes tapered strand geometry and a distinct side-part seam", html.includes("function taperedCurve(") && html.includes("taper=.08+.92*Math.pow(1-t,1.05)") && html.includes("Deep side-part seam") && html.includes("strand=-3;strand<=3;strand++"));
check("side and back bob locks use tapered strand geometry", html.includes("taperedCurve(faceGroup,[[side*.68,.47,.43]") && html.includes("taperedCurve(faceGroup,[[x*.15,.80,-.34]"));

check("browser smoke enforces a sub-75k triangle mobile geometry budget", (await readFile(new URL("./avatar-studio-browser-smoke.mjs", import.meta.url), "utf8")).includes("triangleCount<75000"));

check("browser smoke verifies the Avatar Studio entry from both Chromium and WebKit app pages", (await readFile(new URL("./avatar-studio-browser-smoke.mjs", import.meta.url), "utf8")).includes('studioLink,"./tools/avatar-studio.html"'));

check("Avatar Studio uses mobile-optimized sphere and tube segment counts", html.includes("seg=24") && html.includes("new THREE.SphereGeometry(1,48,36)") && html.includes("new THREE.TubeGeometry(path,24,r,6,false)") && html.includes("tubularSegments=24,radialSegments=5"));

check("shoulders attach to chest and upper-arm meshes attach to their matching humanoid bones", html.includes('"shoulder-left","shoulder-right","necklace-chain"') && html.includes('part.name==="upper-arm-left"?"leftUpperArm":part.name==="upper-arm-right"?"rightUpperArm":null') && html.includes("bones[armBoneName].attach(part)"));

check("skin hair eye and lip palette follows the approved light-blonde blue-eyed reference", html.includes("242+tone") && html.includes("216+tone*.88") && html.includes("204+tone*.82") && html.includes("hair=new THREE.MeshPhysicalMaterial({color:0xe6d0a5") && html.includes("hairLight=new THREE.MeshPhysicalMaterial({color:0xf4e3c4") && html.includes("sheenColor:new THREE.Color(0xffe9c8)") && html.includes("iris=new THREE.MeshPhysicalMaterial({color:0x7899bd") && html.includes("lip=mat(0xc98584"));

check("five named tapered fringe locks layer the swept side-parted bob", html.includes('for(let strand=0;strand<5;strand++)') && html.includes('lock.name="hair-fringe-strand-"+strand') && html.includes("Five fine, swept fringe locks"));

check("nose recesses use soft warm shading rather than hard dark lash material", html.includes('noseShadow=mat(0x986f67,.94)') && html.includes('nostril.name=side<0?"nostril-left":"nostril-right"'));

check("continuous head profile shapes jaw cheeks and chin before adding facial details", html.includes('const jaw=.76') && html.includes('const cheek=1+.055*Math.exp') && html.includes('const cheekbone=.026*Math.exp') && html.includes('const chin=.018*Math.exp') && html.includes('skull.name="facial-skull"'));
