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
  let blinkAvailable = !!vrm.expressionManager;
  let mouthOpen = 0;
  let mouthTarget = 0;
  let idleEnabled = true;
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

  const setLookAt = (x = 0, y = 1.35, z = 2.5) => {
    if (!vrm.lookAt?.target) return false;
    vrm.lookAt.target.position.set(Number(x) || 0, Number(y) || 1.35, Number(z) || 2.5);
    return true;
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

    // Natural idle blink, when the supplied VRM contains the standard blink expression.
    if (blinkAvailable) {
      const phase = elapsed % 4.6;
      const blink = phase < 0.16
        ? Math.sin((phase / 0.16) * Math.PI)
        : 0;
      try {
        vrm.expressionManager.setValue("blink", blink);
      } catch (_) {
        blinkAvailable = false;
      }
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
    setLookAt,
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
