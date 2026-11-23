import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

/**
 * Mount a locally supplied VRM avatar.
 * Rendering stays in the browser; the model bytes remain in the user's IndexedDB.
 */
export async function mountVrmAvatar(host, blob) {
  if (!host || !(blob instanceof Blob)) {
    throw new TypeError("VRM host or model data is missing.");
  }

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  const gltf = await loader.parseAsync(await blob.arrayBuffer(), "");
  const vrm = gltf.userData?.vrm;
  if (!vrm) throw new Error("This file does not contain a supported VRM avatar.");

  if (gltf.userData?.vrm && VRMUtils?.rotateVRM0) {
    try { VRMUtils.rotateVRM0(vrm); } catch (_) {}
  }

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xd9efff, 0x17243a, 1.8));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(1.5, 2.5, 3.0);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x78cfff, 0.8);
  fillLight.position.set(-2.0, 1.0, 1.5);
  scene.add(fillLight);

  scene.add(vrm.scene);

  // Fit the camera to the visible mesh bounds so cropped upper-body/head-only VRMs fit.
  vrm.scene.updateMatrixWorld(true);
  const avatarBounds = new THREE.Box3().setFromObject(vrm.scene);
  const avatarSize = new THREE.Vector3(0.5, 1.6, 0.5);
  const avatarCenter = new THREE.Vector3(0, 1.05, 0);
  if (!avatarBounds.isEmpty()) {
    avatarBounds.getSize(avatarSize);
    avatarBounds.getCenter(avatarCenter);
  }
  const avatarFocus = avatarCenter.clone();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  const fitAvatarCamera = () => {
    const width = Math.max(1, host.clientWidth || 320);
    const height = Math.max(1, host.clientHeight || 180);
    camera.aspect = width / height;
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const verticalDistance = Math.max(avatarSize.y, 0.35) / (2 * Math.tan(verticalFov / 2));
    const horizontalDistance = Math.max(avatarSize.x, 0.35) / (2 * Math.tan(horizontalFov / 2));
    const distance = THREE.MathUtils.clamp(Math.max(verticalDistance, horizontalDistance) * 1.18, 0.85, 8.5);
    // Keep the gaze target between the avatar and camera, even for close-up head-only models.
    avatarFocus.set(avatarCenter.x, avatarCenter.y, avatarCenter.z + Math.min(2.5, distance * 0.7));
    camera.position.set(avatarCenter.x, avatarCenter.y, avatarCenter.z + distance);
    camera.lookAt(avatarCenter);
    camera.updateProjectionMatrix();
  };
  fitAvatarCamera();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power"
    });
  } catch (error) {
    // A failed WebGL context allocation must not leave the parsed avatar's GPU assets retained.
    try { VRMUtils.deepDispose(vrm.scene); } catch (_) {}
    throw error;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  let disposed = false;
  let frameId = 0;
  let blinkAvailable = false;
  // Randomized blink timing avoids a mechanical, metronomic appearance.
  let blinkStartedAt = -1;
  let blinkDuration = 0.14;
  let nextBlinkAt = 2.8 + Math.random() * 2.8;
  let mouthOpen = 0;
  let mouthTarget = 0;
  const mouthVisemeNames = ["aa", "ih", "ou", "ee", "oh"];
  const mouthVisemeCurrent = Object.fromEntries(mouthVisemeNames.map((name) => [name, 0]));
  const mouthVisemeTarget = Object.fromEntries(mouthVisemeNames.map((name) => [name, 0]));
  let activeMouthViseme = "";
  let idleEnabled = true;
  // Emotion weights are blended independently from lip-sync and blink.
  const emotionNames = ["happy", "angry", "sad", "relaxed", "surprised"];
  const emotionCurrent = Object.fromEntries(emotionNames.map((name) => [name, 0]));
  let emotionTarget = "neutral";
  let emotionTargetWeight = 0;
  // Avatar-only automatic gaze: gently shifts focus while keeping the user as the default target.
  let autoLookAtEnabled = !!vrm.lookAt?.target;
  const lookAtCurrent = avatarFocus.clone();
  const lookAtDestination = lookAtCurrent.clone();
  let nextGazeChangeAt = 2.8 + Math.random() * 2.2;
  const expressionAvailability = new Map();
  const idleBaseY = vrm.scene.position.y;
  const idleBaseRotY = vrm.scene.rotation.y;
  // Count only visible animation time; background tabs should not spend GPU frames or jump animation clocks.
  let activeElapsed = 0;
  let lastFrameTimestamp = 0;
  let frameRunning = false;
  let activeEnabled = true;
  let contextLost = false;
  // Normalized humanoid bones are optional; unsupported rigs simply keep their existing motion.
  const neckBone = vrm.humanoid?.getNormalizedBoneNode?.("neck") || null;
  const headBone = vrm.humanoid?.getNormalizedBoneNode?.("head") || null;
  const neckBaseQuaternion = neckBone?.quaternion?.clone?.() || null;
  const headBaseQuaternion = headBone?.quaternion?.clone?.() || null;
  const neckOffsetQuaternion = new THREE.Quaternion();
  const headOffsetQuaternion = new THREE.Quaternion();
  const neckOffsetEuler = new THREE.Euler();
  const headOffsetEuler = new THREE.Euler();
  const headMotionCurrent = new THREE.Vector3();
  const headMotionTarget = new THREE.Vector3();
  let headIdleTarget = new THREE.Vector3();
  let nextHeadMotionAt = 2.5 + Math.random() * 2.5;
  let headGestureStartedAt = -1;

  const setExpression = (name, weight = 1) => {
    if (!vrm.expressionManager || !name || expressionAvailability.get(name) === false) return false;
    try {
      vrm.expressionManager.setValue(name, THREE.MathUtils.clamp(Number(weight) || 0, 0, 1));
      expressionAvailability.set(name, true);
      return true;
    } catch (_) {
      expressionAvailability.set(name, false);
      return false;
    }
  };

  const setMouthOpen = (amount = 0) => {
    mouthTarget = THREE.MathUtils.clamp(Number(amount) || 0, 0, 1);
    activeMouthViseme = "";
    for (const name of mouthVisemeNames) mouthVisemeTarget[name] = 0;
  };

  // VRM standard vowel presets: aa, ih, ou, ee, oh.
  // Unsupported presets are ignored; the existing generic mouth-open remains the fallback.
  const setMouthViseme = (name = "", amount = 0.72) => {
    const viseme = String(name || "").toLowerCase();
    if (!mouthVisemeNames.includes(viseme) || !hasExpression(viseme)) {
      setMouthOpen(amount);
      return false;
    }
    activeMouthViseme = viseme;
    mouthTarget = 0;
    for (const preset of mouthVisemeNames) mouthVisemeTarget[preset] = preset === viseme
      ? THREE.MathUtils.clamp(Number(amount) || 0, 0, 1)
      : 0;
    return true;
  };

  const setEmotion = (name = "neutral", intensity = 1) => {
    const emotion = String(name || "neutral").toLowerCase();
    if (emotion !== "neutral" && !emotionNames.includes(emotion)) return false;
    if (emotion !== "neutral" && !hasExpression(emotion)) return false;
    emotionTarget = emotion;
    emotionTargetWeight = emotion === "neutral"
      ? 0
      : THREE.MathUtils.clamp(Number(intensity) || 0, 0, 1);
    return true;
  };

  const setLookAt = (x = avatarFocus.x, y = avatarFocus.y, z = avatarFocus.z) => {
    if (!vrm.lookAt?.target) return false;
    autoLookAtEnabled = false;
    lookAtDestination.set(
      Number.isFinite(Number(x)) ? Number(x) : avatarFocus.x,
      Number.isFinite(Number(y)) ? Number(y) : avatarFocus.y,
      Number.isFinite(Number(z)) ? Number(z) : avatarFocus.z
    );
    lookAtCurrent.copy(lookAtDestination);
    vrm.lookAt.target.position.copy(lookAtCurrent);
    return true;
  };

  const setAutoLookAt = (enabled = true) => {
    if (!vrm.lookAt?.target) return false;
    autoLookAtEnabled = !!enabled;
    if (autoLookAtEnabled) {
      lookAtDestination.copy(avatarFocus);
      nextGazeChangeAt = activeElapsed + 1.5 + Math.random() * 1.5;
    }
    return true;
  };

  const setHeadGesture = (name = "nod") => {
    if (name !== "nod" || (!headBone && !neckBone)) return false;
    headGestureStartedAt = activeElapsed;
    return true;
  };

  const hasExpression = (name) => {
    try {
      return !!vrm.expressionManager?.getExpression?.(name);
    } catch (_) {
      return false;
    }
  };

  // Do not report or animate blink merely because an expression manager exists.
  // A model must actually contain the standard blink preset.
  const hasSingleBlink = hasExpression("blink");
  const hasSplitBlink = hasExpression("blinkLeft") && hasExpression("blinkRight");
  blinkAvailable = hasSingleBlink || hasSplitBlink;

  const getDiagnostics = () => {
    const metaName = String(vrm.meta?.name || vrm.meta?.title || "").trim();
    return {
      format: "VRM",
      name: metaName || "名称なし",
      webglContextLost: contextLost,
      humanoidNeck: !!neckBone,
      humanoidHead: !!headBone,
      headMotion: !!(neckBone || headBone),
      lookAt: !!vrm.lookAt?.target,
      blink: hasExpression("blink") || (hasExpression("blinkLeft") && hasExpression("blinkRight")),
      blinkLeft: hasExpression("blinkLeft"),
      blinkRight: hasExpression("blinkRight"),
      aa: hasExpression("aa"),
      ih: hasExpression("ih"),
      ou: hasExpression("ou"),
      ee: hasExpression("ee"),
      oh: hasExpression("oh"),
      mouthVisemes: mouthVisemeNames.filter((name) => hasExpression(name)),
      happy: hasExpression("happy"),
      sad: hasExpression("sad"),
      angry: hasExpression("angry"),
      relaxed: hasExpression("relaxed"),
      surprised: hasExpression("surprised"),
      emotionPresets: emotionNames.filter((name) => hasExpression(name))
    };
  };

  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    fitAvatarCamera();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  host.replaceChildren(renderer.domElement);

  const animate = (timestamp = 0) => {
    if (disposed || !activeEnabled || document.visibilityState !== "visible") {
      frameRunning = false;
      frameId = 0;
      lastFrameTimestamp = 0;
      return;
    }
    try {
    const delta = lastFrameTimestamp
      ? Math.min(Math.max(0, (timestamp - lastFrameTimestamp) / 1000), 0.05)
      : 0;
    lastFrameTimestamp = timestamp;
    activeElapsed += delta;
    const elapsed = activeElapsed;

    // Natural, irregular idle blink, when the supplied VRM has the standard expression.
    if (blinkAvailable) {
      if (elapsed >= nextBlinkAt) {
        blinkStartedAt = elapsed;
        blinkDuration = 0.12 + Math.random() * 0.06;
        // Occasionally add a soft second blink; otherwise wait a varied interval.
        nextBlinkAt = elapsed + blinkDuration +
          (Math.random() < 0.12 ? 0.20 : 3.0 + Math.random() * 3.5);
      }
      const blinkProgress = (elapsed - blinkStartedAt) / blinkDuration;
      const blink = blinkProgress >= 0 && blinkProgress <= 1
        ? Math.sin(blinkProgress * Math.PI)
        : 0;
      try {
        if (hasExpression("blink")) {
          vrm.expressionManager.setValue("blink", blink);
        } else {
          vrm.expressionManager.setValue("blinkLeft", blink);
          vrm.expressionManager.setValue("blinkRight", blink);
        }
      } catch (_) {
        blinkAvailable = false;
      }
    }

    // Avatar-only gaze: linger on the user, occasionally glance aside, and ease back naturally.
    if (autoLookAtEnabled && vrm.lookAt?.target) {
      if (elapsed >= nextGazeChangeAt) {
        const glance = Math.random() < 0.68;
        lookAtDestination.set(
          avatarFocus.x + (glance ? (Math.random() - 0.5) * 0.34 : 0),
          avatarFocus.y + (glance ? (Math.random() - 0.5) * 0.14 : 0),
          avatarFocus.z
        );
        nextGazeChangeAt = elapsed + 2.8 + Math.random() * 3.8;
      }
      const gazeEase = 1 - Math.exp(-delta * 2.4);
      lookAtCurrent.lerp(lookAtDestination, gazeEase);
      vrm.lookAt.target.position.copy(lookAtCurrent);
    }

    // Blend emotional presets gradually; never overwrite lip-sync or blink weights.
    const emotionEase = 1 - Math.exp(-delta * 3.2);
    for (const name of emotionNames) {
      const target = name === emotionTarget ? emotionTargetWeight : 0;
      emotionCurrent[name] += (target - emotionCurrent[name]) * emotionEase;
      setExpression(name, emotionCurrent[name]);
    }

    // Blend vowel visemes independently from emotion and blink.
    const mouthEase = Math.min(1, delta * 18);
    mouthOpen += (mouthTarget - mouthOpen) * mouthEase;
    for (const name of mouthVisemeNames) {
      mouthVisemeCurrent[name] += (mouthVisemeTarget[name] - mouthVisemeCurrent[name]) * mouthEase;
    }
    if (vrm.expressionManager) {
      if (activeMouthViseme) {
        for (const name of mouthVisemeNames) setExpression(name, mouthVisemeCurrent[name]);
      } else {
        setExpression("aa", mouthOpen);
        setExpression("oh", mouthOpen * 0.18);
        for (const name of ["ih", "ou", "ee"]) setExpression(name, 0);
      }
    }

    // Very subtle idle breathing/sway; disableable by the host.
    if (idleEnabled) {
      vrm.scene.position.y = idleBaseY + Math.sin(elapsed * 1.25) * 0.008;
      vrm.scene.rotation.y = idleBaseRotY + Math.sin(elapsed * 0.42) * 0.018;
    }

    vrm.update(delta);

    // Small idle head adjustments plus a brief, smooth nod after a reply.
    if (idleEnabled && elapsed >= nextHeadMotionAt) {
      headIdleTarget.set(
        (Math.random() - 0.5) * 0.022,
        (Math.random() - 0.5) * 0.052,
        (Math.random() - 0.5) * 0.028
      );
      nextHeadMotionAt = elapsed + 4.0 + Math.random() * 4.0;
    }
    const gestureProgress = headGestureStartedAt < 0
      ? -1
      : (elapsed - headGestureStartedAt) / 0.78;
    const nodAmount = gestureProgress >= 0 && gestureProgress <= 1
      ? Math.sin(gestureProgress * Math.PI) * 0.055
      : 0;
    if (gestureProgress > 1) headGestureStartedAt = -1;
    const headEase = 1 - Math.exp(-delta * 3.0);
    headMotionTarget.set(
      (idleEnabled ? headIdleTarget.x : 0) + nodAmount,
      idleEnabled ? headIdleTarget.y : 0,
      idleEnabled ? headIdleTarget.z : 0
    );
    headMotionCurrent.lerp(headMotionTarget, headEase);
    if (neckBone && neckBaseQuaternion) {
      const neckShare = headBone ? 0.28 : 1;
      neckOffsetEuler.set(headMotionCurrent.x * neckShare,headMotionCurrent.y * neckShare,headMotionCurrent.z * neckShare,"XYZ");
      neckOffsetQuaternion.setFromEuler(neckOffsetEuler);
      neckBone.quaternion.copy(neckBaseQuaternion).multiply(neckOffsetQuaternion);
    }
    if (headBone && headBaseQuaternion) {
      const headShare = neckBone ? 0.72 : 1;
      headOffsetEuler.set(headMotionCurrent.x * headShare,headMotionCurrent.y * headShare,headMotionCurrent.z * headShare,"XYZ");
      headOffsetQuaternion.setFromEuler(headOffsetEuler);
      headBone.quaternion.copy(headBaseQuaternion).multiply(headOffsetQuaternion);
    }
    renderer.render(scene, camera);
    // Schedule the next frame only after this frame completed successfully.
    frameId = requestAnimationFrame(animate);
    } catch (error) {
      // Stop a failing loop instead of repeatedly throwing on every animation frame.
      frameRunning = false;
      frameId = 0;
      lastFrameTimestamp = 0;
      console.error("[ALVIS VRM] Render loop stopped after a frame error.", error);
    }
  };
  const startRenderLoop = () => {
    if (disposed || contextLost || !activeEnabled || frameRunning || document.visibilityState !== "visible") return;
    frameRunning = true;
    lastFrameTimestamp = 0;
    frameId = requestAnimationFrame(animate);
  };
  const stopRenderLoop = () => {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    frameRunning = false;
    lastFrameTimestamp = 0;
  };
  const handleWebGLContextLost = (event) => {
    // Three.js can restore the context after this event only when the browser is allowed to.
    event.preventDefault();
    contextLost = true;
    stopRenderLoop();
    console.warn("[ALVIS VRM] WebGL context lost; waiting for browser restoration.");
  };
  const handleWebGLContextRestored = () => {
    contextLost = false;
    lastFrameTimestamp = 0;
    console.info("[ALVIS VRM] WebGL context restored; resuming avatar rendering.");
    startRenderLoop();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") startRenderLoop();
    else stopRenderLoop();
  };
  renderer.domElement.addEventListener("webglcontextlost", handleWebGLContextLost, false);
  renderer.domElement.addEventListener("webglcontextrestored", handleWebGLContextRestored, false);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", stopRenderLoop);
  window.addEventListener("pageshow", handleVisibilityChange);
  startRenderLoop();

  return {
    vrm,
    setMouthOpen,
    setMouthViseme,
    setExpression,
    setEmotion,
    setLookAt,
    setAutoLookAt,
    setHeadGesture,
    getDiagnostics,
    setIdleEnabled(value) { idleEnabled = !!value; },
    setActive(value) {
      if (disposed) return false;
      activeEnabled = !!value;
      if (activeEnabled) startRenderLoop();
      else stopRenderLoop();
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopRenderLoop();
      renderer.domElement.removeEventListener("webglcontextlost", handleWebGLContextLost, false);
      renderer.domElement.removeEventListener("webglcontextrestored", handleWebGLContextRestored, false);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", stopRenderLoop);
      window.removeEventListener("pageshow", handleVisibilityChange);
      resizeObserver.disconnect();
      try { vrm.expressionManager?.setValue("blink", 0); } catch (_) {}
      // Release the model's GPU-backed geometry, materials, and textures before dropping the renderer.
      // The VRM was parsed from its own Blob, so these resources are not shared with another avatar.
      try { VRMUtils.deepDispose(vrm.scene); } catch (_) {}
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === host) {
        renderer.domElement.remove();
      }
    }
  };
}
