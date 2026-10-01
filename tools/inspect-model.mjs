// What is this car model made of? Prints every material with its triangle count, primitive modes,
// texture and where it sits on the car, in the same space the page uses (buildCar in index.html):
// 5 m long, centred on x/z, sitting on y = 0, y up, nose towards +z, +x = the car's left side.
// Use it to fill roleOf() in index.html: paint, glass, tyres, rims, calipers, lamps, mirrors, trim.
//
// usage (from tools/, after `npm install`):  node inspect-model.mjs <model.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

const file = process.argv[2];
if (!file) {
  console.error('usage: node inspect-model.mjs <model.glb>');
  process.exit(1);
}
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(file);
const root = doc.getRoot();
const scene = root.getDefaultScene() || root.listScenes()[0];

const mul = (m, v) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
];
const newBox = () => [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
const grow = (b, v) => { for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], v[k]); b[k + 3] = Math.max(b[k + 3], v[k]); } };

const mats = new Map();
const all = newBox();
const tmp = [0, 0, 0];
scene.traverse((node) => {
  const mesh = node.getMesh();
  if (!mesh) return;
  const world = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial();
    const name = mat ? mat.getName() || '(unnamed)' : '(no material)';
    let e = mats.get(name);
    if (!e) {
      mats.set(name, e = {
        tris: 0, prims: 0, modes: new Set(), box: newBox(),
        tex: !!(mat && mat.getBaseColorTexture()),
        alpha: mat ? mat.getAlphaMode() : '-',
        color: mat ? mat.getBaseColorFactor().slice(0, 3).map((c) => Math.round(c * 255)) : null,
        metal: mat ? mat.getMetallicFactor() : null,
      });
    }
    const pos = prim.getAttribute('POSITION');
    if (!pos) continue;
    e.prims++;
    e.modes.add(prim.getMode());
    if (prim.getMode() === 4) e.tris += (prim.getIndices() ? prim.getIndices().getCount() : pos.getCount()) / 3;
    for (let i = 0; i < pos.getCount(); i++) {
      const v = mul(world, pos.getElement(i, tmp));
      grow(e.box, v); grow(all, v);
    }
  }
});

const size = [all[3] - all[0], all[4] - all[1], all[5] - all[2]];
const axis = ['x', 'y', 'z'];
console.log(`\n${file}`);
console.log(`raw size  x ${size[0].toFixed(3)}  y ${size[1].toFixed(3)}  z ${size[2].toFixed(3)}  (longest: ${axis[size.indexOf(Math.max(...size))]})`);
if (size[2] < size[0] || size[1] > size[2]) {
  console.log('!  the page expects y up and the car\'s length along z: rotate the scene in buildCar before normalising');
}
const s = 5 / size[2], cx = (all[0] + all[3]) / 2, cz = (all[2] + all[5]) / 2;
const toCar = (b) => [(b[0] - cx) * s, (b[1] - all[1]) * s, (b[2] - cz) * s, (b[3] - cx) * s, (b[4] - all[1]) * s, (b[5] - cz) * s];
const dims = [size[0] * s, size[1] * s, size[2] * s].map((v) => v.toFixed(2));
console.log(`car space W ${dims[0]}  H ${dims[1]}  L ${dims[2]} m  (scale ${s.toFixed(4)})\n`);

// a first guess only: confirm every role by isolating the material in the page
const guess = (name, e, b) => {
  const n = name.toLowerCase();
  if (e.modes.size && ![...e.modes].includes(4)) return 'lines: run build-model.mjs';
  if (/glass|window|windshield|windscreen/.test(n) || e.alpha === 'BLEND') return 'glass?';
  if (/tire|tyre|rubber/.test(n)) return 'tyre?';
  if (/rim|wheel|alloy/.test(n)) return 'rim?';
  if (/calip|brake/.test(n)) return 'caliper?';
  if (/mirror|chrome/.test(n)) return 'mirror?';
  if (/light|lamp|head|tail|led/.test(n)) return b[5] > 1.5 ? 'head?' : b[2] < -1.5 ? 'tail?' : 'lamp?';
  return '';
};
const rows = [...mats.entries()].sort((a, b) => b[1].tris - a[1].tris);
// the paint is usually the most colourful material that runs the full length and height of the body
const sat = (e) => (e.color ? Math.max(...e.color) - Math.min(...e.color) : 0);
const bodyLike = rows.filter(([, e]) => { const b = toCar(e.box); return b[5] - b[2] > 4.5 && b[4] > 1.2 && e.alpha !== 'BLEND'; });
const biggest = bodyLike.length ? bodyLike.sort((a, b) => sat(b[1]) - sat(a[1]) || b[1].tris - a[1].tris)[0][0] : '';
const pad = (v, n) => String(v).padEnd(n);
console.log(pad('material', 26) + pad('tris', 9) + pad('prims', 7) + pad('tex', 5) + pad('alpha', 7) + pad('rgb', 14) + pad('x', 15) + pad('y', 13) + pad('z', 15) + 'guess');
for (const [name, e] of rows) {
  const b = toCar(e.box);
  const r = (lo, hi) => `${lo.toFixed(2)}..${hi.toFixed(2)}`;
  const g = guess(name, e, b) || (name === biggest ? 'paint?' : '');
  console.log(
    pad(name.slice(0, 25), 26) + pad(Math.round(e.tris), 9) + pad(e.prims, 7) + pad(e.tex ? 'yes' : '', 5) + pad(e.alpha, 7) +
    pad(e.color ? e.color.join(',') : '-', 14) + pad(r(b[0], b[3]), 15) + pad(r(b[1], b[4]), 13) + pad(r(b[2], b[5]), 15) + g,
  );
}
console.log('\nmodes: 4 = triangles; anything else is lines/points and should be stripped by build-model.mjs');
