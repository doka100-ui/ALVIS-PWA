/**
 * Read-only GLB 2.0 inspector for ALVIS avatar candidates.
 * Parses only the local file selected by the user. No network, storage, or upload.
 */
export function parseGlb(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 20) throw new Error("GLBファイルが短すぎます。");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("GLBマジックがありません。GLB 2.0を選択してください。");
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error("GLB version 2.0のみ対応しています。");
  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== bytes.byteLength) throw new Error("GLBヘッダーのサイズと実ファイルサイズが一致しません。");

  let offset = 12;
  let json = null;
  let binBytes = 0;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error("GLBチャンクヘッダーが途中で切れています。");
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > bytes.byteLength) throw new Error("GLBチャンクがファイル範囲を超えています。");
    if (chunkType === 0x4e4f534a) {
      if (json) throw new Error("JSONチャンクが複数あります。");
      const text = new TextDecoder().decode(bytes.subarray(start, end)).replace(/[\u0000\u0020]+$/g, "");
      try { json = JSON.parse(text); } catch { throw new Error("GLB JSONチャンクを解析できません。"); }
    } else if (chunkType === 0x004e4942) {
      binBytes += chunkLength;
    }
    offset = end;
  }
  if (!json || typeof json !== "object") throw new Error("GLBにJSONチャンクがありません。");

  const meshes = Array.isArray(json.meshes) ? json.meshes : [];
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const accessors = Array.isArray(json.accessors) ? json.accessors : [];
  let vertices = 0, triangles = 0, primitives = 0, morphTargetCount = 0;
  const morphNames = new Set();
  for (const mesh of meshes) {
    const names = mesh.extras && Array.isArray(mesh.extras.targetNames) ? mesh.extras.targetNames : [];
    for (const name of names) if (typeof name === "string") morphNames.add(name);
    for (const primitive of (mesh.primitives || [])) {
      primitives++;
      const positionIndex = primitive.attributes && primitive.attributes.POSITION;
      const position = Number.isInteger(positionIndex) ? accessors[positionIndex] : null;
      const vertexCount = position && Number.isFinite(position.count) ? position.count : 0;
      vertices += vertexCount;
      const indexAccessor = Number.isInteger(primitive.indices) ? accessors[primitive.indices] : null;
      const elementCount = indexAccessor && Number.isFinite(indexAccessor.count) ? indexAccessor.count : vertexCount;
      const mode = primitive.mode === undefined ? 4 : primitive.mode;
      if (mode === 4) triangles += Math.floor(elementCount / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(0, elementCount - 2);
      if (Array.isArray(primitive.targets)) morphTargetCount = Math.max(morphTargetCount, primitive.targets.length);
    }
  }
  const skins = Array.isArray(json.skins) ? json.skins : [];
  const jointCount = skins.reduce((sum, skin) => sum + (Array.isArray(skin.joints) ? skin.joints.length : 0), 0);
  const animations = Array.isArray(json.animations) ? json.animations : [];
  const extensions = json.extensions || {};
  const vrm = extensions.VRMC_vrm || null;
  const humanBones = vrm && vrm.humanoid && vrm.humanoid.humanBones ? vrm.humanoid.humanBones : {};
  const vrmExpressions = vrm && vrm.expressions ? vrm.expressions : {};
  const presetExpressions = vrmExpressions.preset || {};
  const customExpressions = vrmExpressions.custom || {};
  const extensionNames = Array.isArray(json.extensionsUsed) ? json.extensionsUsed : [];
  const hasLegacyVrm = Boolean(extensions.VRM);
  const requiredExtensions = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [];
  const externalUris = [];
  for (const item of [...(json.images || []), ...(json.buffers || [])]) {
    if (item && typeof item.uri === "string" && !item.uri.startsWith("data:")) externalUris.push(item.uri);
  }
  const hasSkin = skins.length > 0 && jointCount > 0;
  const hasHumanoid = Object.keys(humanBones).length >= 3;
  const expressionNames = Object.keys(presetExpressions).concat(Object.keys(customExpressions));
  return {
    version, fileBytes: bytes.byteLength, binBytes, sceneCount: (json.scenes || []).length,
    meshCount: meshes.length, primitiveCount: primitives, nodeCount: nodes.length,
    vertexCount: vertices, triangleCount: triangles, skinCount: skins.length,
    jointCount, hasSkin, animationCount: animations.length,
    morphTargetCount, morphTargetNames: [...morphNames],
    materialCount: (json.materials || []).length, textureCount: (json.textures || []).length,
    imageCount: (json.images || []).length, externalUris,
    extensionsUsed: extensionNames, extensionsRequired: requiredExtensions,
    hasVrm1: Boolean(vrm), hasVrm0: hasLegacyVrm, hasHumanoid,
    humanoidBoneCount: Object.keys(humanBones).length,
    presetExpressions: Object.keys(presetExpressions), customExpressions: Object.keys(customExpressions),
    hasLookAt: Boolean(vrm && vrm.lookAt),
    looksALVISReady: Boolean(vrm && hasHumanoid && hasSkin)
  };
}
