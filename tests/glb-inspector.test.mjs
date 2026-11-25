import test from "node:test";
import assert from "node:assert/strict";
import { parseGlb } from "../tools/glb-inspector.js";

function makeGlb(document) {
  const json = Buffer.from(JSON.stringify(document));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const total = 12 + 8 + padded.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const chunk = Buffer.alloc(8);
  chunk.writeUInt32LE(padded.length, 0);
  chunk.writeUInt32LE(0x4e4f534a, 4);
  return Buffer.concat([header, chunk, padded]);
}

test("parses GLB mesh counts and VRM 1.0 humanoid metadata", () => {
  const glb = makeGlb({
    asset: { version: "2.0" },
    accessors: [{ count: 9 }, { count: 3 }],
    meshes: [{ extras: { targetNames: ["blink", "happy"] }, primitives: [
      { attributes: { POSITION: 0 }, indices: 1, targets: [{}, {}] }
    ] }],
    nodes: [{ name: "Body" }],
    skins: [{ joints: [0, 1, 2] }],
    animations: [{ name: "Idle", channels: [] }],
    extensions: { VRMC_vrm: {
      humanoid: { humanBones: { hips: { node: 0 }, spine: { node: 1 }, head: { node: 2 } },
      },
      expressions: { preset: { blink: {}, happy: {}, aa: {} }, custom: {} },
      lookAt: {}
    } },
    extensionsUsed: ["VRMC_vrm"]
  });
  const result = parseGlb(glb);
  assert.equal(result.version, 2);
  assert.equal(result.meshCount, 1);
  assert.equal(result.vertexCount, 9);
  assert.equal(result.triangleCount, 1);
  assert.equal(result.jointCount, 3);
  assert.equal(result.hasVrm1, true);
  assert.equal(result.hasHumanoid, true);
  assert.equal(result.hasLookAt, true);
  assert.deepEqual(result.morphTargetNames, ["blink", "happy"]);
  assert.deepEqual(result.presetExpressions, ["blink", "happy", "aa"]);
  assert.equal(result.looksALVISReady, true);
});

test("rejects non-GLB data", () => {
  assert.throws(() => parseGlb(new Uint8Array(32)), /マジック/);
});

test("rejects mismatched declared length", () => {
  const bytes = makeGlb({ asset: { version: "2.0" } });
  bytes.writeUInt32LE(bytes.length + 4, 8);
  assert.throws(() => parseGlb(bytes), /サイズ/);
});

test("rejects malformed JSON chunk", () => {
  const bytes = makeGlb({ asset: { version: "2.0" } });
  bytes.fill(0x7b, 20, bytes.length);
  assert.throws(() => parseGlb(bytes), /JSONチャンク/);
});

test("reports ordinary GLB without VRM as not ready", () => {
  const result = parseGlb(makeGlb({ asset: { version: "2.0" }, meshes: [], nodes: [] }));
  assert.equal(result.hasVrm1, false);
  assert.equal(result.looksALVISReady, false);
});
