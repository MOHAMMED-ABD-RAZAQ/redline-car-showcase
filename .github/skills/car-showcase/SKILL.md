---
name: car-showcase
description: Build or adapt a scroll-driven, interactive 3D car showcase page (three.js + Web Audio, one index.html, no build step) for any car. Use when someone wants the Redline page rebuilt for another car, a new paint or livery, new copy and specs, or help preparing a downloaded car model (GLB/glTF) for the web.
license: MIT
---

# Car showcase

`index.html` at the repo root is the whole product. It tells one car's story as you scroll:

- a hero you can drag and repaint
- a teardown where every panel flies off on its own beat
- specs
- a 360° colour studio
- an engine you start and rev, with a burnout
- a drive-off

Around that it adds spring-smoothed scrolling, soft watch-crown ticks while you scroll, and a phone layout.

This skill is the recipe for doing the same for another car without starting over. Change the car, keep the machinery.

## Before you touch code

Get these from the user. Ask one question at a time, and never invent specs.

1. **The car**: make, model, year, trim, and the hero paint with its real paint name (e.g. "Hellraisin").
2. **A model they may use on a website.** Sketchfab is the usual source. Downloads need their login, so they download the file themselves (the glTF/GLB download).
   - **CC-BY**: fine to ship and commit. Credit the author in the footer and README.
   - **Sketchfab Standard, Editorial, or any paid license**: usable on the page, but the file must **not** be committed to a public repo or offered as a download. Keep it git-ignored (`.gitignore` already ignores `assets/*`), and keep the footer notice that forbids extracting it.
   - **One fused mesh with a single material**: avoid it. Role mapping, the panel split and the wheel spin all need separate materials.
3. **Spec numbers** (power, torque, 0–100, gears), from the manufacturer or the user.
4. **Brand and tone**: keep "Redline." unless they want another name.

## Workflow

Work through these in order. After each step, serve the folder (`python3 -m http.server 5178`) and look at the page.

### 1. Prepare the model

```bash
cd tools && npm install
node build-model.mjs ~/Downloads/<download>.glb ../assets/<car>.min.glb   # clean + meshopt + WebP
node inspect-model.mjs ../assets/<car>.min.glb                              # materials, sizes, guesses
```

`build-model.mjs` drops line and point primitives (SketchUp exports draw every edge as a line). It keeps meshes and materials separate on purpose.

Aim for under 4 MB. Then point `loader.load('assets/hellcat.min.glb', …)` in `index.html` at the new file.

### 2. Orientation and scale

`buildCar` assumes the scene is y-up with its length along z. It normalises the car to 5 m long, centred, standing on y = 0. In that car space, +z is the nose, +x is the car's left, and y is up.

`inspect-model.mjs` warns when the longest axis isn't z. If so, rotate the glTF scene before the bounding box is taken. If the nose lands at −z, rotate it by π around y.

Every measured number in the code (shut lines, crease, ring centres) is in this car space.

### 3. Map materials to roles: `roleOf()`

Every material name maps to one role. Start from the `inspect-model.mjs` output (triangle counts, and where each material sits along the car), then confirm each one by eye.

| role | what it is | notes |
|---|---|---|
| `paint` | body colour | Gets the paint shader, the explode offsets and the livery. Often also holds calipers or mirror caps, which are split off by position. |
| `head` / `tail` | lamps | `tail` gets an emissive red; `head` gets the halo shader (step 6). |
| `glass` | windows | Kept transparent, made rougher. |
| `tyre`, `rim`, `caliper` | wheel parts | Rims are used to find the wheel centres. |
| `mirror` | mirror glass | Set to a chrome mirror. |
| `trim` | everything else | |

To confirm a role, give that one material a loud emissive colour in `tuneMaterial`, reload, and look.

Skip invisible helper materials in the bake loop. The Hellcat has one, a `Color_B02` lens fill.

### 4. Wheels

The rims are bucketed by quadrant to find the four wheel centres. Each wheel gets a `pivot`, which spins, and a `caliper` group, which steers but never spins.

Tune `WR`, the hit radius (roughly the tyre radius), until every tyre and rim triangle is captured and no body triangle is.

Check it by spinning: scroll into the finale. Each wheel must turn about its own axle, with no body pieces rotating along.

### 5. Teardown panels: `PANELS`, `panelOf()`, `zDoorF`/`zDoorR`

The body is split, triangle by triangle, into hood, trunk, nose, tail, doors, fenders, quarters, glass, roof and cabin. Each panel has an offset and a start delay in `PANELS`.

1. Measure the new car's door shut lines with the debug view below. `zDoorF` and `zDoorR` give each shut line's z as a function of height.
2. Tune the `panelOf` thresholds until each panel leaves in one piece.

Two traps:

- **The hood skin.** If it is its own connected piece inside the paint mesh, `hoodTriangles()` finds it by connectivity and bounding box. Adjust that bounding-box test for the new car.
- **See-through door gaps.** The gaps are real holes. Side-on against a bright sky you can see through both doors, so a dark `blind` plane sits inside the assembled car. Resize it.

### 6. Lamps

On the Challenger, the lamp is a photo texture whose rings don't line up with the 3D bezels. So `addHaloRings` tones the photo down, and `buildHalos` adds real light-pipe rings. The ring centres and radii are measured into `RING_IN` and `RING_OUT` as (|x|, y, radius).

For another car, either:

- measure its lamp openings and rebuild `buildHalos` to match its signature (strips, rings, or nothing), or
- drop `buildHalos` and give the `head` material a plain emissive.

Keep `capDirectSpecular`. It caps sun glints so they can't bloom into fake extra lamps.

### 7. Paint, livery, copy

**Paints.** `paints` holds the colour-studio swatches. Use that car's real paint names and colours.

**Livery.** `addPaint` carries the T/A livery:

- a satin black hood, roof and decklid, set per panel through `aDecal`
- a side band that follows the measured body crease (`TA_CREASE` / `creaseY`), with "T/A" cut out of it (`taLettersTexture`)

For a car without a livery, return `taDecal = 0`. For a different stripe, measure that car's crease and redraw the band.

**Copy.** It all lives in `<main>`: hero headline and lede, callouts, the four stats (`data-to`, `data-dec`, `data-from`), the colour studio, and the finale. Keep the voice short and concrete.

**Footer.** It needs the model credit with its licence link, a trademarks line, the maker credit, and links to this repo and skill.

### 8. Engine and sound

`buildEngine` is a hand-built supercharged HEMI for the teardown, made of rounded boxes and cylinders. Rebuild its silhouette for the new engine, or scale it with `ENGINE_SCALE`.

The `engine` object is a Web Audio synth:

- Its pitch is the firing frequency: rpm / 60 × cylinders / 2.
- Idle rpm and the lope LFO set the idle character. Tune both for the new car.
- The burnout squeal is band-passed noise.

Everything feeds one master gain, so the nav toggle mutes the whole page.

### 9. Camera and story: `KF`

`KF` holds keyframes per section:

- **Camera:** `theta` (orbit angle), `r` (distance), `h` (height), `lookY` (look-at height), `shift` (desktop horizontal offset), and `my` (phone vertical offset).
- **State:** `explode`, `lights`, `head`, `drive`, `follow`, `spin`, `audio`, `mouse`.

On phones and portrait tablets, `fitRadius` frames the whole car automatically, so only `my` needs tuning there.

`S.audio` also fades the scroll ticks out where the engine takes over.

### 10. Verify

1. Shoot desktop and phone with `node .github/skills/car-showcase/scripts/shoot.mjs` (options are in its header), at a few scroll points per section.
2. Check:
   - There are no console errors.
   - Wheels spin on their own axles.
   - Panels leave whole and come back cleanly.
   - Lamps read right from the front three-quarter view.
   - Nothing overlaps on a 360 px wide phone or a landscape phone.
3. Scroll with a mouse wheel and with a trackpad. It should ease in and out, and the copy and the car should move together.

## Debug view: measuring the car

Use this to read real coordinates off the model: crease height, shut lines, lamp centres.

1. Point the hero camera side-on. In `KF.hero` set `theta: Math.PI / 2`, `r: 9.5`, `h: 1`, `mouse: 0`, `shift: 0`.
2. In the `addPaint` fragment shader, replace `#include <dithering_fragment>` with:

```glsl
#include <dithering_fragment>
vec3 n = normalize(vCarN);
vec3 dbg = n.y < 0.15 ? vec3(.1,.2,.9) : n.y < 0.42 ? vec3(.1,.8,.2) : n.y < 0.88 ? vec3(.95,.85,.1) : vec3(.9,.1,.1);
if (abs(fract(vCar.z / 0.25 + 0.5) - 0.5) * 0.25 < 0.004) dbg = vec3(0.0);  // z every 25 cm
if (abs(fract(vCar.y / 0.05 + 0.5) - 0.5) * 0.05 < 0.0015) dbg *= 0.55;     // y every 5 cm
gl_FragColor = vec4(dbg, 1.0);
```

3. Screenshot it and read values off the image. The colour bands show the creases: blue faces are vertical sides, yellow faces are the inclined shoulder. The grid lines give z and y in metres.
4. Remove it afterwards.

## Things that bit us

- **Sketchfab downloads need the user's login.** Ask the user to download, then run `build-model.mjs`.
- **SketchUp exports are messy.** They carry line primitives and transparent edge fills, and the paint can be split across several materials. Clean first, inspect second.
- **Directional lights behind the car** streak across the flanks toward a front camera. Light it from the front or the sides.
- **Door shut-line walls catch a low sun** as hot lines. Faces on the shut line that point fore and aft get a dark `seam` material.
- **Don't draw on a photo-textured part.** The texture rarely lines up with the geometry. Draw in car space (`vCar`) and measure.
- **Keep the fallbacks:**
  - the reduced-motion path (no glide, instant camera)
  - the touch copy (`data-touch`)
  - tap-to-repaint on phones
- **Audio needs a real click, tap or key.** Scrolling doesn't count, and scripted clicks are ignored. That is why the page opens on an "Enter with sound / Enter muted" screen once the model has loaded. `unlockAudio` wakes the audio on that click, and the sound toggle shows "off" until the page can actually be heard.
