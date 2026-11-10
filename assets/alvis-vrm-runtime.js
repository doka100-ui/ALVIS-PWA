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

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  camera.position.set(0, 1.35, 3.2);
  camera.lookAt(0, 1.05, 0);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power"
  });
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
  let idleEnabled = true;
  // Emotion weights are blended independently from lip-sync and blink.
  const emotionNames = ["happy", "angry", "sad", "relaxed", "surprised"];
  const emotionCurrent = Object.fromEntries(emotionNames.map((name) => [name, 0]));
  let emotionTarget = "neutral";
  let emotionTargetWeight = 0;
  // Avatar-only automatic gaze: gently shifts focus while keeping the user as the default target.
  let autoLookAtEnabled = !!vrm.lookAt?.target;
  const lookAtCurrent = new THREE.Vector3(0, 1.35, 2.5);
  const lookAtDestination = lookAtCurrent.clone();
  let nextGazeChangeAt = 2.8 + Math.random() * 2.2;
  const expressionAvailability = new Map();
  const idleBaseY = vrm.scene.position.y;
  const idleBaseRotY = vrm.scene.rotation.y;
  const clock = new THREE.Clock();

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

  const setLookAt = (x = 0, y = 1.35, z = 2.5) => {
    if (!vrm.lookAt?.target) return false;
    autoLookAtEnabled = false;
    lookAtDestination.set(Number(x) || 0, Number(y) || 1.35, Number(z) || 2.5);
    lookAtCurrent.copy(lookAtDestination);
    vrm.lookAt.target.position.copy(lookAtCurrent);
    return true;
  };

  const setAutoLookAt = (enabled = true) => {
    if (!vrm.lookAt?.target) return false;
    autoLookAtEnabled = !!enabled;
    if (autoLookAtEnabled) {
      lookAtDestination.set(0, 1.35, 2.5);
      nextGazeChangeAt = clock.elapsedTime + 1.5 + Math.random() * 1.5;
    }
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
      humanoidHead: !!vrm.humanoid?.getNormalizedBoneNode?.("head"),
      lookAt: !!vrm.lookAt?.target,
      blink: hasExpression("blink") || (hasExpression("blinkLeft") && hasExpression("blinkRight")),
      blinkLeft: hasExpression("blinkLeft"),
      blinkRight: hasExpression("blinkRight"),
      aa: hasExpression("aa"),
      oh: hasExpression("oh"),
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
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  host.replaceChildren(renderer.domElement);

  const animate = () => {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;

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
          glance ? (Math.random() - 0.5) * 0.34 : 0,
          1.35 + (glance ? (Math.random() - 0.5) * 0.14 : 0),
          2.5
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

    // Smoothly follow audio amplitude so the mouth does not snap between frames.
    mouthOpen += (mouthTarget - mouthOpen) * Math.min(1, delta * 18);
    if (vrm.expressionManager) {
      setExpression("aa", mouthOpen);
      setExpression("oh", mouthOpen * 0.18);
    }

    // Very subtle idle breathing/sway; disableable by the host.
    if (idleEnabled) {
      vrm.scene.position.y = idleBaseY + Math.sin(elapsed * 1.25) * 0.008;
      vrm.scene.rotation.y = idleBaseRotY + Math.sin(elapsed * 0.42) * 0.018;
    }

    vrm.update(delta);
    renderer.render(scene, camera);
  };
  animate();

  return {
    vrm,
    setMouthOpen,
    setExpression,
    setEmotion,
    setLookAt,
    setAutoLookAt,
    getDiagnostics,
    setIdleEnabled(value) { idleEnabled = !!value; },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      try { vrm.expressionManager?.setValue("blink", 0); } catch (_) {}
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === host) {
        renderer.domElement.remove();
      }
    }
  };
}
