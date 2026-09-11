/**
 * K10 Hub — STEP to GLB Conversion Script
 *
 * Uses occt-import-js (pure WASM OpenCASCADE) to tessellate K10.step,
 * then writes a binary GLTF (.glb) using @gltf-transform/core.
 *
 * Usage:  node scripts/convert-step.mjs
 * Output: frontend/public/models/k10.glb
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Document, NodeIO } from '@gltf-transform/core';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT      = resolve(__dirname, '..');
const STEP_FILE = resolve(ROOT, 'K10.step');
const OUT_DIR   = resolve(ROOT, 'frontend', 'public', 'models');
const OUT_FILE  = resolve(OUT_DIR, 'k10.glb');

function mb(bytes) { return (bytes / 1024 / 1024).toFixed(1) + 'MB'; }
function elapsed(start) { return ((Date.now() - start) / 1000).toFixed(1) + 's'; }

console.log('');
console.log('  K10 Hub — STEP → GLB Converter');
console.log('  ────────────────────────────────');

if (!existsSync(STEP_FILE)) {
  console.error(`  ERROR: K10.step not found at:\n  ${STEP_FILE}`);
  process.exit(1);
}

if (existsSync(OUT_FILE)) {
  // Remove stale 0-byte GLB from previous failed attempt
  if (statSync(OUT_FILE).size < 100) {
    console.log('  Removing stale/empty GLB from previous run...');
    rmSync(OUT_FILE);
  } else {
    console.log(`  GLB already exists (${mb(statSync(OUT_FILE).size)}).`);
    console.log('  Delete frontend/public/models/k10.glb to force reconversion.');
    process.exit(0);
  }
}

mkdirSync(OUT_DIR, { recursive: true });

console.log(`  Input  : K10.step (${mb(statSync(STEP_FILE).size)})`);
console.log(`  Output : k10.glb`);
console.log('');

// ─── 1. Load occt-import-js WASM ─────────────────────────────────────────────
let t = Date.now();
console.log('  [1/4] Loading OpenCASCADE WASM...');
const occtImport = require('occt-import-js');
const occt = await occtImport();
console.log(`        Done (${elapsed(t)})`);

// ─── 2. Tessellate STEP ───────────────────────────────────────────────────────
t = Date.now();
console.log('  [2/4] Tessellating K10.step (this takes ~30-90s)...');

// IMPORTANT: Must be Uint8Array, not Buffer
const rawBuffer = readFileSync(STEP_FILE);
const fileContent = new Uint8Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength);

const result = occt.ReadStepFile(fileContent, {
  linearUnit: 'millimeter',
  linearDeflectionType: 'bounding_box_ratio',
  linearDeflection: 0.05,   // 5% of bounding box — good quality
  angularDeflection: 0.3,
});

console.log(`        Done (${elapsed(t)}) — success=${result.success}, meshes=${result.meshes?.length ?? 0}`);

if (!result.success || !result.meshes?.length) {
  console.error('  ERROR: Tessellation failed or produced no meshes.');
  process.exit(1);
}

// ─── 3. Inspect mesh data ─────────────────────────────────────────────────────
let validMeshes = 0;
let totalVerts  = 0;
let totalTris   = 0;

for (const m of result.meshes) {
  const posArr = m.attributes?.position?.array;
  const idxArr = m.index?.array;
  if (posArr?.length > 0 && idxArr?.length > 0) {
    validMeshes++;
    totalVerts += posArr.length / 3;
    totalTris  += idxArr.length / 3;
  }
}

console.log(`        Valid meshes: ${validMeshes}/${result.meshes.length}`);
console.log(`        Vertices: ${totalVerts.toLocaleString()}`);
console.log(`        Triangles: ${totalTris.toLocaleString()}`);

if (validMeshes === 0) {
  console.error('  ERROR: All meshes have empty geometry arrays.');
  console.error('  The STEP file may require a different linear deflection or unit setting.');
  process.exit(1);
}

// ─── 4. Build GLTF document ───────────────────────────────────────────────────
t = Date.now();
console.log('  [3/4] Building GLTF document...');

const doc    = new Document();
const scene  = doc.createScene('K10');
const buffer = doc.createBuffer();

// Default material palette based on typical PCB board colors
const PALETTE = [
  [0.13, 0.35, 0.17, 1.0],  // PCB green
  [0.55, 0.55, 0.57, 1.0],  // Metal/silver
  [0.10, 0.10, 0.12, 1.0],  // Black plastic
  [0.75, 0.75, 0.78, 1.0],  // Light grey
  [0.82, 0.62, 0.20, 1.0],  // Gold/copper
  [0.20, 0.20, 0.22, 1.0],  // Dark grey
  [0.90, 0.90, 0.90, 1.0],  // White
];

let mi = 0;
for (let i = 0; i < result.meshes.length; i++) {
  const mesh   = result.meshes[i];
  const posArr = mesh.attributes?.position?.array;
  const idxArr = mesh.index?.array;

  if (!posArr?.length || !idxArr?.length) continue;

  const positions = Float32Array.from(posArr);
  const indices   = idxArr.every(v => v <= 65535)
    ? Uint16Array.from(idxArr)
    : Uint32Array.from(idxArr);

  const posAcc = doc.createAccessor()
    .setType('VEC3')
    .setArray(positions)
    .setBuffer(buffer);

  const idxAcc = doc.createAccessor()
    .setType('SCALAR')
    .setArray(indices)
    .setBuffer(buffer);

  const prim = doc.createPrimitive()
    .setAttribute('POSITION', posAcc)
    .setIndices(idxAcc);

  // Normals if available
  const normArr = mesh.attributes?.normal?.array;
  if (normArr?.length === posArr.length) {
    const normals = Float32Array.from(normArr);
    const normAcc = doc.createAccessor()
      .setType('VEC3')
      .setArray(normals)
      .setBuffer(buffer);
    prim.setAttribute('NORMAL', normAcc);
  }

  // Color — use mesh color if available, else palette
  let baseColor;
  if (mesh.color && mesh.color.length >= 3) {
    baseColor = [mesh.color[0], mesh.color[1], mesh.color[2], 1.0];
  } else {
    baseColor = PALETTE[mi % PALETTE.length];
  }

  const mat = doc.createMaterial(`mat_${i}`)
    .setBaseColorFactor(baseColor)
    .setMetallicFactor(0.4)
    .setRoughnessFactor(0.6)
    .setDoubleSided(false);

  prim.setMaterial(mat);

  const gltfMesh = doc.createMesh(`mesh_${i}`).addPrimitive(prim);
  const node = doc.createNode(`node_${i}`).setMesh(gltfMesh);
  scene.addChild(node);
  mi++;
}

console.log(`        GLTF built (${elapsed(t)}) — ${mi} mesh nodes`);

// ─── 5. Write GLB ─────────────────────────────────────────────────────────────
t = Date.now();
console.log('  [4/4] Writing GLB...');
const io  = new NodeIO();
const glb = await io.writeBinary(doc);
writeFileSync(OUT_FILE, glb);

const glbSize = mb(statSync(OUT_FILE).size);
console.log(`        Written (${elapsed(t)}) — ${glbSize}`);
console.log('');
console.log(`  Conversion complete!`);
console.log(`  frontend/public/models/k10.glb (${glbSize})`);
console.log('');
console.log('  The 3D hero view is now active. Refresh http://localhost:5173');
console.log('');
