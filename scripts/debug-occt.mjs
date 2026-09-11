/**
 * Debug script — inspect the raw output structure from occt-import-js
 * so we can build the GLB writer correctly.
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT      = resolve(__dirname, '..');
const STEP_FILE = resolve(ROOT, 'K10.step');

console.log('Loading OCCT WASM...');
const occtImport = require('occt-import-js');
const occt = await occtImport();

console.log('Reading STEP file...');
const stepBuffer = readFileSync(STEP_FILE);

const result = occt.ReadStepFile(stepBuffer, null);
console.log('success:', result.success);
console.log('mesh count:', result.meshes.length);

// Inspect first 3 meshes in detail
for (let i = 0; i < Math.min(3, result.meshes.length); i++) {
  const m = result.meshes[i];
  console.log(`\n=== Mesh ${i} ===`);
  console.log('keys:', Object.keys(m));
  console.log('has attributes:', !!m.attributes);
  if (m.attributes) {
    console.log('  attributes keys:', Object.keys(m.attributes));
    if (m.attributes.position) {
      const pos = m.attributes.position;
      console.log('  position keys:', Object.keys(pos));
      console.log('  position.array type:', pos.array?.constructor?.name);
      console.log('  position.array length:', pos.array?.length);
      // If it has itemSize / count
      if (pos.itemSize !== undefined) console.log('  position.itemSize:', pos.itemSize);
      if (pos.count !== undefined) console.log('  position.count:', pos.count);
    }
  }
  if (m.index) {
    const idx = m.index;
    console.log('  index keys:', Object.keys(idx));
    console.log('  index.array type:', idx.array?.constructor?.name);
    console.log('  index.array length:', idx.array?.length);
  }
  // Show all top-level properties
  for (const key of Object.keys(m)) {
    const val = m[key];
    if (typeof val !== 'object' || val === null) {
      console.log(`  ${key}: ${val}`);
    } else if (Array.isArray(val)) {
      console.log(`  ${key}: Array(${val.length})`);
    }
  }
}

// Also check what ReadStepFile keys look like at top level
console.log('\n=== Result top-level keys ===');
console.log(Object.keys(result));
