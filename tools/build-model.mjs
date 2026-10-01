// One step from a downloaded car model to the web-ready file the page loads.
// 1. Clean: drop line/point primitives (SketchUp exports draw every edge as a line) and the fully
//    transparent "edge_color" fills that come with them.
// 2. Optimize: meshopt geometry, WebP textures capped at 1024 px. Meshes, materials and nodes are kept
//    apart on purpose: the page maps materials to roles by name and splits the body into panels itself.
//
// usage (from tools/, after `npm install`):
//   node build-model.mjs <downloaded.glb> ../assets/<car>.min.glb
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node build-model.mjs <downloaded.glb> <out.min.glb>');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(input);

let lines = 0, edges = 0;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    if (prim.getMode() !== 4) { mesh.removePrimitive(prim); prim.dispose(); lines++; continue; }
    if (mat && /^edge_color/.test(mat.getName())) { mesh.removePrimitive(prim); prim.dispose(); edges++; }
  }
}
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (mesh && !mesh.listPrimitives().length) node.setMesh(null);
}
await doc.transform(prune());

const dir = mkdtempSync(join(tmpdir(), 'car-model-'));
const clean = join(dir, 'clean.glb');
await io.write(clean, doc);
console.log(`cleaned: removed ${lines} line/point primitives and ${edges} edge fills`);

try {
  execFileSync('npx', [
    'gltf-transform', 'optimize', clean, output,
    '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '1024',
    '--palette', 'false', '--join', 'false', '--flatten', 'false', '--instance', 'false', '--simplify', 'false',
  ], { stdio: 'inherit' });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`wrote ${output} (${(statSync(output).size / 1e6).toFixed(2)} MB)`);
