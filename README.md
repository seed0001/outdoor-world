# Outdoor World

A first-person, physics-driven 3D sandbox built with **React**, **react-three-fiber**, **drei**, and **Rapier**. Walk through rolling hills, watch fish swim under a reactive lake, feel a tornado shred a forest, and stand in falling snow as the seasons turn.

The whole world runs on one shared world clock: **one real-world hour = one in-game day, thirty real-world days = one in-game year**. Every system — sky, weather, trees, snow on the ground, butterflies, fish behaviour, tornado frequency — derives its state from that clock.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually <http://localhost:5173>). Click the canvas to lock your mouse, then walk.

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / Arrows | Move |
| `Shift` | Run |
| `Space` | Jump |
| Mouse | Look |
| `Esc` | Release mouse (also exits **sturdy placement** mode if active) |
| `F1` | Toggle the dev panel |
| `C` | **Sturdy shelter:** open placement preview (or craft a **sturdy shelter kit** from **14 sticks + 6 stones** if you have no kit, inventory & cooldown permitting) |
| `B` | While previewing (green ring): place the shelter, consuming one kit |
| `F` | Interact / chop (contextual) |

Append `?debug` to the URL for physics collider visualisation and an FPS counter. Append `?timeScale=60` to fast-forward the simulation 60× (one in-game day per minute); `?season=summer` jumps straight to mid-summer.

## What's in the world

**Environment**
- Procedural hilly terrain with a carved-out bowl-shaped **lake**.
- Trimesh collider exactly matching the rendered surface.
- ~180 instanced trees (two-part: trunk + foliage) and a scattering of rocks.
- A circular volumetric cloud layer that darkens and thickens with the weather.

**Day / night & seasons**
- Sun and moon orbit a shared clock; twilight, sunset and sunrise recolour the sky shader in real time.
- Four seasons blended through twelve months: trees bud, green, yellow, drop leaves, and stand bare, each with a per-tree phase offset so the canopy doesn't change in lockstep.
- Ground material blends grass → snow based on accumulated precipitation and air temperature. Wetness darkens the soil after rain.

**Weather** (state machine, season-biased)
- Clear, cloudy, rain, hail, thunderstorm, snow, blizzard, tornado.
- Rain falls as GPU-simulated lines that splash the lake and dampen the ground.
- Hail spheres bounce, damage the player on direct hits.
- Lightning: flash light, procedural bolt geometry, Web Audio thunder with distance delay and low-pass filtering, close strikes deal damage and shake the camera.
- **Tornadoes** push the player, lift debris, and *permanently* topple trees and displace rocks they sweep over — the world remembers.

**Wildlife & plants**
- A pond of 14 **fish** with wander-steering AI, containment inside the lake volume, tail-wag synced to swim speed. Slow to near-stillness in freezing water.
- 5 **timber rattlesnakes** on the ground with rigged idle animations.
- 16 **butterflies** with full skeletal rigs, crossfading between `hover` / `idle` / `take_off_and_land` clips through a FLYING → LANDING → RESTING → TAKING_OFF state machine. They vanish at night, in winter, and during storms.
- ~160 **flowers** in clustered patches (two of which centre on butterfly rest spots), instanced for performance, alpha-cut-out billboards with wind sway whose strength tracks the weather. Bloom in spring, peak summer, wilt in autumn, gone in winter.

**Player & UI**
- Capsule rigid body, WASD + jump + run, grounded via downward raycast.
- **Held axe (first-person):** GLB model at `public/models/axe/axe.glb` with tuned grip alignment and orientation (`systems/settings/axeOrientation.ts`). The asset is **preloaded** when `HeldAxe` loads so it appears at startup rather than after other heavy downloads. A procedural fallback renders if the file is missing or loading fails.
- Health system: fall damage, lightning damage, hail damage, tornado damage.
- HUD: clock, date, season, weather icon + label, temperature, health bar, damage vignette, death screen, respawn; contextual hints for **sturdy shelter** placement and inventory (kits live in a dedicated hotbar slot).
- **Sturdy primitive shelter:** craftable **sturdy shelter kits** (recipe above; you can hold **up to six** kits). Place with preview ring on valid ground (`B`). The Meshy **FBX** is scaled with a **uniform** factor so the largest axis is ~**3.5 m** (walk-in size, not map-sized). **`SturdyFrames`** (and its FBX download) mount only after **at least one** shelter exists, so the first load stays lighter; the **axe** GLB is preloaded separately for immediate first-person view. **Physics** uses a **thin floor slab** only — a full bounding-box cuboid filled the interior and blocked entry; walls/roof have no collider so you can walk inside. Shelter instances are tracked in `systems/world/sturdyFrames.ts`.
- **Boot overlay:** `GameBootLoader` shows a full-screen progress bar while early assets load, with a timeout so a stuck huge download does not block forever.
- Dev panel (`F1`): scrub time scale, jump seasons, force weather, spawn/cancel tornado, trigger lightning, respawn, reset world destruction; can grant shelter kits for testing.

## Project layout

```
src/
  main.tsx                 React root
  App.tsx                  device splash → GameRoot
  GameRoot.tsx             Canvas, XR, Physics, world + player graph, HUD shell
  styles.css               HUD, dev panel, overlays

  systems/                 Headless state: observable stores + pure calendar math
    world/
      worldClock.ts        performance.now-based sim clock, subscribe(), URL params
      calendar.ts          season, month, foliageLevel, snowTarget, temperatureC
      groundState.ts       snowLevel & wetness accumulators
      worldState.ts        permanent destruction (fallen trees, displaced rocks)
      commands.ts          event bus between dev panel and world systems
      treeRegistry.ts      deterministic tree specs
      rockRegistry.ts      deterministic rock specs
      snakeRegistry.ts     deterministic snake specs
      fishRegistry.ts      deterministic fish specs
      butterflyRegistry.ts deterministic butterfly specs
      flowerRegistry.ts    cluster-based flower placement
      sturdyFrames.ts      placed shelter instances + subscribe API
      sturdyCraftConstants.ts  shelter kit recipe + inventory cap
    weather/
      types.ts             WeatherType union + WeatherState
      weatherSystem.ts     season-biased state machine + forceWeather()
    player/
      health.ts            hp / damage / respawn + useHealth hook
      playerRef.ts         shared rigid body ref + camera-shake bus
    ui/
      sturdyPlacementState.ts  placement mode + ground preview target

  world/
    terrain.ts             heightAt(x,z), lake carving, insideLake, PRNG
    Sky.tsx                sun + moon + stars + dynamic shader uniforms
    Clouds.tsx             drei <Clouds>, modulated by weather
    Ground.tsx             displaced plane + trimesh collider
    Trees.tsx              instanced trunks + foliage w/ seasonal shader
    Rocks.tsx              instanced rocks
    Lake.tsx               custom water shader: ripples, spec, foam, ice, rain
    Fish.tsx               FBX-loaded fish with wander AI & cold-water slowdown
    Snakes.tsx             GLB-loaded rigged rattlesnakes
    Butterfly.tsx          GLB-loaded rigged butterflies, flight state machine
    Flowers.tsx            instanced FBX flowers w/ wind sway + seasonal bloom
    Lightning.tsx          flash light, bolt geometry, synthed thunder
    Tornado.tsx            funnel + debris + wind field + persistent destruction
    SturdyFrames.tsx       Meshy shelter FBX: uniform scale, floor-only physics
    SturdyPlacementPreview.tsx  placement ring + validity (green / orange)
    Precipitation/
      Rain.tsx             GPU lines
      Hail.tsx             GPU spheres w/ bounce + player damage
      Snow.tsx             GPU flakes feeding ground accumulation
      index.tsx            aggregator
    shaders/
      foliageMaterial.ts   per-instance seasonal colour + sway patch
      groundMaterial.ts    grass↔snow blend + wetness patch

  player/
    Player.tsx             capsule RigidBody, input, camera, fall damage
    HeldAxe.tsx            first-person axe + hand rig, GLTF preload, swing visual
    ChopSystem.tsx         tree chop rays; B places shelter in preview mode
    ActionFSystem.tsx      F-key use; C crafts/opens sturdy placement preview
    TreeInspectRay.tsx     contextual inspect
    usePlayerControls.ts   keyboard control map + typed getter

  systems/settings/
    axeOrientation.ts      held-axe mesh euler (grip + blade direction)

  ui/
    HUD.tsx                crosshair, world readout, health, death screen, sturdy hints
    GameBootLoader.tsx     first-load progress overlay (drei useProgress)
    DevPanel.tsx           F1 debug overlay
    WeatherIcon.tsx        glyph renderer
```

Bootstrap: `main.tsx` → `App.tsx` (device selection) → `GameRoot.tsx` (3D world + overlays).

## How it fits together

Every visual subsystem reads from one of two stores every frame:

- **`worldClock.snapshot()`** — current absolute sim time, `dayFrac`, `yearFrac`, and derived indices.
- **`weatherSystem.getWeather()`** — current `WeatherState`: type, intensity, rainRate, windStrength, tempMod, etc.

Nothing calls `three.Clock` directly. Dragging the `timeScale` slider in the dev panel changes the speed of *every* system in lockstep — sun, sky, foliage, snow, fish lethargy — because they all derive from the same clock.

Persistent world changes (fallen trees, displaced rocks) live in `worldState.ts` and are respected by the render components, so a tornado that levels a grove leaves a visible scar until you click **Reset destruction** in the dev panel.

## Assets

Ships with runtime-ready GLB/FBX assets in `public/models/`:

- `timber-rattlesnake.glb` — rigged idle animations
- `butterfly.glb` — 156-joint rig, three animation clips (`hover`, `idle`, `take_off_and_land`)
- `fish/Fish.FBX` + loose textures — with URL-remapping for baked-in filename mismatches
- `flower/Flower.fbx` + loose textures — materials rebuilt from external PNGs (alpha-cut-out billboard)
- `axe/axe.glb` — first-person axe (add locally if not present; `HeldAxe` falls back to a procedural mesh)

**Primitive sturdy shelter** (`primitive-sturdy/`)

- **Textures** (`*.png`) are in the repo.
- The **FBX** (`Meshy_AI_A_primitive_sturdy_w_0418175525_texture.fbx`, ~117 MB) is **not committed**: it exceeds GitHub’s **100 MB** per-file limit, and hosting it via **Git LFS** may hit account storage/bandwidth caps. It is listed in `public/models/primitive-sturdy/.gitignore`. For a full local build, place that file next to the textures yourself (e.g. copy from your Meshy export or attach it via **GitHub Releases** / cloud storage for teammates).

## GitHub / large files

- Single files on GitHub must stay **under 100 MB**.
- Optional **Git LFS** for big binaries requires sufficient **LFS data** on the org/account; if LFS push fails, keep huge assets out of git and distribute them separately.

## Tech stack

- **React** 19 + **TypeScript** + **Vite** 8
- **three** 0.184
- **@react-three/fiber** 9
- **@react-three/drei** 10
- **@react-three/rapier** 2 (Rapier physics)
- **three-stdlib** for `FBXLoader`, `TGALoader`, `SkeletonUtils`, `mergeBufferGeometries`

## Notes on design

- **Deterministic registries.** Every placed entity (tree, rock, snake, butterfly, flower) comes from a seeded mulberry32 generator in a `*Registry.ts` file, so layouts are identical across reloads and safe to reason about.
- **Instanced rendering by default.** Trees, rocks, and flowers share a single `InstancedMesh` / `<Instances>` each — hundreds of props cost roughly a single draw call.
- **Shader patches via `onBeforeCompile`.** Rather than authoring new shaders from scratch for trees, ground, and flowers, we inject small GLSL snippets into three's standard materials — we keep PBR lighting, shadows and fog for free and only add the behaviour we need (seasonal tint, snow blend, wind sway).
- **GPU particles for precipitation.** Rain / hail / snow are single draw-call Points systems with custom shaders driving movement, size, and fade.
- **No file mutation without permission.** Entity behaviour lives in its own component; shared subsystems publish state through tiny observable stores rather than global singletons that components poke at.
