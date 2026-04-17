/**
 * Wood is not a generic “stick” — each species has material personality that
 * emerges from calendar + time-of-day + temperature. Crafting systems can read
 * `WoodHarvestTraits` without inventing combat-style “abilities.”
 *
 * Species map (see treeRegistry): Oak, Pine, Birch, Elm (wide spreading crown).
 * Future: add Willow / Maple as distinct kinds when placement supports them.
 */

import { temperatureC, yearPhase } from "./calendar";
import type { WorldTimeSnapshot } from "./worldClock";
import type { TreeKind } from "./treeRegistry";

export const TREE_KIND_NAMES: readonly [string, string, string, string] = [
  "Oak",
  "Pine",
  "Birch",
  "Elm",
];

export function treeKindName(kind: TreeKind): string {
  return TREE_KIND_NAMES[kind] ?? "Oak";
}

/** Subtle tint for world log meshes — species read at a glance. */
export function logMeshColor(kind: TreeKind): string {
  switch (kind) {
    case 0:
      return "#5c3a1a";
    case 1:
      return "#3d2e18";
    case 2:
      return "#6b5a4a";
    case 3:
      return "#4a5a38";
  }
}

/** Normalized 0–1 traits for recipes / durability math / UI copy. */
export interface WoodHarvestTraits {
  kind: TreeKind;
  /** Structural longevity — oak leads. */
  durability: number;
  /** Pine / dry birch — torches, fire starters. */
  flammability: number;
  /** Clean processing — birch leads. */
  refinement: number;
  /** Bows, bindings — elm leads (willow-like role until a dedicated kind exists). */
  flexibility: number;
  /** Resin (pine) + sap energy (maple-style curves reserved for future species). */
  energyResin: number;
  /** Night / rain bias — affects drying, smoke, glue cure times. */
  moisture: number;
  /** Morning harvest bonus — “green” potency for food chains / bait. */
  freshness: number;
  /** Short labels for tooltips / dev readouts. */
  tags: string[];
}

export interface WoodHarvestOptions {
  /** Player height for lapse; defaults 0. */
  elevation?: number;
  /** From `getWeather().tempMod`. */
  weatherTempMod?: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 0 = deep night, 1 = full day — used for moisture / dew. */
function nightFactor(dayFrac: number): number {
  const d = Math.min(dayFrac, 1 - dayFrac) * 2;
  return smoothstep(0.35, 0.12, d);
}

/** Peak mid-morning (dayFrac ~0.28–0.32 for a dawn-noon arc). */
function morningFreshness(dayFrac: number): number {
  const dist = Math.abs(dayFrac - 0.29);
  return Math.exp(-dist * dist * 80);
}

/** Summer band in yearPhase: ~0.12–0.38 (calendar yearPhase spring→summer). */
function summerResinBoost(yearFrac: number): number {
  const p = yearPhase(yearFrac);
  const mid = smoothstep(0.08, 0.22, p) * (1 - smoothstep(0.38, 0.55, p));
  return mid;
}

/** “Sap run” when nights are cold but days thaw — late winter / early spring. */
function sapRunFactor(yearFrac: number, tempC: number): number {
  const p = yearPhase(yearFrac);
  const springEdge = smoothstep(0.7, 0.92, p) + smoothstep(0, 0.12, p);
  const tempOk = smoothstep(18, 6, tempC) * smoothstep(-6, 4, tempC);
  return Math.min(1, springEdge * 0.65 + tempOk * 0.45);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Resolve material traits for wood harvested at this moment.
 * Call at chop time (standing → log, log → sticks, or future bench processing).
 */
export function computeWoodHarvestTraits(
  kind: TreeKind,
  snap: WorldTimeSnapshot,
  opts: WoodHarvestOptions = {},
): WoodHarvestTraits {
  const elev = opts.elevation ?? 0;
  const wmod = opts.weatherTempMod ?? 0;
  const tempC = temperatureC(snap, elev, wmod);
  const nf = nightFactor(snap.dayFrac);
  const fresh = morningFreshness(snap.dayFrac);
  const resinSummer = summerResinBoost(snap.yearFrac);
  const sapRun = sapRunFactor(snap.yearFrac, tempC);

  const base = {
    durability: 0.5,
    flammability: 0.45,
    refinement: 0.5,
    flexibility: 0.45,
    energyResin: 0.35,
    moisture: 0.4 + nf * 0.35,
    freshness: 0.55 + fresh * 0.4,
  };

  const tags: string[] = [];

  switch (kind) {
    case 0: {
      // Oak — stability / structure
      base.durability = 0.92;
      base.flammability = 0.38;
      base.refinement = 0.55;
      base.flexibility = 0.42;
      base.energyResin = 0.25;
      base.moisture += nf * 0.08;
      base.freshness += fresh * 0.12;
      tags.push("foundations", "tool handles", "slow decay");
      break;
    }
    case 1: {
      // Pine — resin / combustion / temperature response
      base.durability = 0.62;
      base.flammability = 0.88;
      base.refinement = 0.4;
      base.flexibility = 0.58;
      base.energyResin = 0.45 + resinSummer * 0.45;
      base.moisture += nf * 0.12;
      base.freshness += fresh * 0.08;
      if (resinSummer > 0.35) tags.push("high resin (summer)");
      tags.push("torches", "pitch", "bindings");
      break;
    }
    case 2: {
      // Birch — purity / processing
      base.durability = 0.58;
      base.flammability = 0.55;
      base.refinement = 0.9;
      base.flexibility = 0.48;
      base.energyResin = 0.3 + sapRun * 0.25;
      base.moisture += nf * 0.06;
      base.freshness += fresh * 0.22;
      if (fresh > 0.55) tags.push("morning-clean");
      tags.push("benches", "precision tools", "clean burn");
      break;
    }
    case 3: {
      // Elm — flexible / moisture (closest to willow in this build)
      base.durability = 0.55;
      base.flammability = 0.48;
      base.refinement = 0.52;
      base.flexibility = 0.88;
      base.energyResin = 0.32;
      base.moisture += nf * 0.18;
      base.freshness += fresh * 0.1;
      tags.push("bends", "traps", "wet wood");
      break;
    }
  }

  // Weather: cold / wet air nudges moisture; clear hot days dry surface.
  base.moisture = clamp01(base.moisture + wmod * -0.015);
  base.freshness = clamp01(base.freshness + (nf > 0.6 ? 0.05 : 0));

  return {
    kind,
    durability: clamp01(base.durability),
    flammability: clamp01(base.flammability),
    refinement: clamp01(base.refinement),
    flexibility: clamp01(base.flexibility),
    energyResin: clamp01(base.energyResin),
    moisture: clamp01(base.moisture),
    freshness: clamp01(base.freshness),
    tags,
  };
}

/** One-line “what this species is” for inspect UI. */
export function treeKindEcologyBlurb(kind: TreeKind): string {
  switch (kind) {
    case 0:
      return "Dense hardwood — predictable grain, rots slowly, holds weight.";
    case 1:
      return "Resinous softwood — flexible in the wind, loves heat and flame.";
    case 2:
      return "Pale, easy-splitting wood — clean burns and fine edges.";
    case 3:
      return "Spreading crown, tough fibres — bends instead of snapping.";
  }
}

/** Static craft directions (future benches will read traits + these roles). */
export function craftingDirectionsForKind(
  kind: TreeKind,
): readonly { title: string; items: readonly string[] }[] {
  switch (kind) {
    case 0:
      return [
        {
          title: "Structures & tools",
          items: [
            "Foundations, frames, storage that lasts",
            "Tool handles, hafts, long-life gear",
          ],
        },
        {
          title: "Processing",
          items: ["Slow seasoning — fewer cracks when dried"],
        },
      ];
    case 1:
      return [
        {
          title: "Fire & light",
          items: [
            "Torches, fire starters, pitch / sealants",
            "Bindings and tarps (resin-rich cuts)",
          ],
        },
        {
          title: "Season note",
          items: ["Summer harvest: more resin in the wood"],
        },
      ];
    case 2:
      return [
        {
          title: "Precision & benches",
          items: [
            "Crafting benches, carved fittings",
            "Clean charcoal, low-soot fuel",
          ],
        },
        {
          title: "Time note",
          items: ["Morning wood: extra “fresh” for food prep / bait chains"],
        },
      ];
    case 3:
      return [
        {
          title: "Flex & wet work",
          items: [
            "Bows, pack frames, springy traps",
            "Fishing gear, bridges near water",
          ],
        },
        {
          title: "Feel",
          items: ["Higher moisture when cut at night — plan drying"],
        },
      ];
  }
}
