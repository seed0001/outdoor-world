import {
  HALF_X,
  WORLD_MAX_Z,
  GRASS_BIOME_Z_MIN,
  heightAt,
  belowLakeWaterLine,
  insideLake,
  mulberry32,
} from "../../world/terrain";
import { butterflies } from "./butterflyRegistry";
import { FLOWER_PLACEMENT_SEED } from "./worldSeed";

export interface FlowerSpec {
  id: number;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  /** Per-instance phase so wind sway is decorrelated. */
  phase: number;
  /** Which cluster this flower belongs to (for debug / future use). */
  cluster: number;
}

interface Cluster {
  x: number;
  z: number;
  radius: number;
  count: number;
}

const MARGIN = 6;
const MIN_DIST_FROM_SPAWN = 5;
const CLUSTER_COUNT = 12;
const MIN_CLUSTER_RADIUS = 2.4;
const MAX_CLUSTER_RADIUS = 4.5;

function generate(): FlowerSpec[] {
  const rand = mulberry32(FLOWER_PLACEMENT_SEED);
  const clusters: Cluster[] = [];

  // Cluster anchors — random patches on open terrain.
  let guard = 0;
  while (clusters.length < CLUSTER_COUNT && guard++ < CLUSTER_COUNT * 30) {
    const x = (rand() - 0.5) * 2 * (HALF_X - MARGIN);
    const z =
      GRASS_BIOME_Z_MIN +
      MARGIN +
      rand() * (WORLD_MAX_Z - GRASS_BIOME_Z_MIN - 2 * MARGIN);
    if (Math.hypot(x, z) < MIN_DIST_FROM_SPAWN) continue;
    const radius = MIN_CLUSTER_RADIUS + rand() * (MAX_CLUSTER_RADIUS - MIN_CLUSTER_RADIUS);
    // Whole cluster disk must clear the lake bowl + shore (not just the anchor).
    if (insideLake(x, z, radius + 3.5)) continue;
    clusters.push({ x, z, radius, count: 8 + Math.floor(rand() * 9) });
  }

  // Bonus patches around a couple of butterfly rest spots so butterflies
  // have somewhere to "land on". Picks the first two rest spots that aren't
  // in the lake and aren't already claimed by another cluster nearby.
  let bonusPlaced = 0;
  for (const b of butterflies) {
    if (bonusPlaced >= 2) break;
    if (insideLake(b.restX, b.restZ, 4)) continue;
    const tooClose = clusters.some(
      (c) => Math.hypot(c.x - b.restX, c.z - b.restZ) < 6,
    );
    if (tooClose) continue;
    clusters.push({
      x: b.restX,
      z: b.restZ,
      radius: 2.0 + rand() * 1.2,
      count: 6 + Math.floor(rand() * 5),
    });
    bonusPlaced++;
  }

  // Flowers — sqrt-disk sample inside each cluster so density drops softly
  // toward the rim rather than the centre being bald.
  const out: FlowerSpec[] = [];
  clusters.forEach((c, ci) => {
    for (let i = 0; i < c.count; i++) {
      let x = 0;
      let z = 0;
      let ok = false;
      for (let attempt = 0; attempt < 18 && !ok; attempt++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * c.radius;
        x = c.x + Math.cos(a) * r;
        z = c.z + Math.sin(a) * r;
        // Wide lake margin: the bowl extends past the nominal rim; also reject
        // anything whose terrain sits under the water surface.
        if (insideLake(x, z, 3)) continue;
        if (belowLakeWaterLine(x, z, 0.28)) continue;
        ok = true;
      }
      if (!ok) continue;
      out.push({
        id: out.length,
        x,
        y: heightAt(x, z),
        z,
        rot: rand() * Math.PI * 2,
        scale: 0.7 + rand() * 0.55,
        phase: rand(),
        cluster: ci,
      });
    }
  });

  return out;
}

export const flowers: ReadonlyArray<FlowerSpec> = generate();
