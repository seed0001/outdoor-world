import { snapshot } from "./worldClock";
import { getWeather } from "../weather/weatherSystem";
import { foliageLevel } from "./calendar";
import { worldState } from "./worldState";
import { trees } from "./treeRegistry";
import { rocks } from "./rockRegistry";
import { snakes } from "./snakeRegistry";
import { fishes } from "./fishRegistry";
import { butterflies } from "./butterflyRegistry";
import { flowers } from "./flowerRegistry";
import { rats } from "./ratRegistry";
import { computeButterflyVisibility } from "./butterflyVisibility";

/** Volumetric cloud billboards (see `world/Clouds.tsx`). */
export const CLOUD_BILLBOARDS = 14;
/** GPU particle counts (see `world/Precipitation/*`). */
export const PARTICLE_RAIN = 5000;
export const PARTICLE_HAIL = 800;
export const PARTICLE_SNOW = 4500;
/** Tornado debris points (`world/Tornado.tsx`). */
export const TORNADO_DEBRIS = 1800;

export interface EcosystemSnapshot {
  time: {
    monthIndex: number;
    seasonIndex: number;
    yearFrac: number;
    dayFrac: number;
    foliageLevel: number;
  };
  flora: {
    treesSpawned: number;
    treesStanding: number;
    treesFallen: number;
    flowersPlaced: number;
    /** 0..1 — flower group scale from seasonal bloom. */
    flowerBloomTarget: number;
  };
  fauna: {
    snakes: number;
    rats: number;
    fish: number;
    butterfliesSpawned: number;
    butterflyVisibility: ReturnType<typeof computeButterflyVisibility>;
  };
  geology: {
    rocksSpawned: number;
    rocksStatic: number;
    rocksDisplaced: number;
  };
  atmosphere: {
    cloudBillboards: number;
    rainParticles: number;
    hailParticles: number;
    snowParticles: number;
    tornadoDebrisParticles: number;
  };
  player: {
    /** You. */
    humans: 1;
  };
}

export function getEcosystemSnapshot(): EcosystemSnapshot {
  const world = snapshot();
  const weather = getWeather();
  const fallen = worldState.listFallenTrees().length;
  const displaced = worldState.listDisplacedRocks().length;

  return {
    time: {
      monthIndex: world.monthIndex,
      seasonIndex: world.seasonIndex,
      yearFrac: world.yearFrac,
      dayFrac: world.dayFrac,
      foliageLevel: foliageLevel(world.yearFrac),
    },
    flora: {
      treesSpawned: trees.length,
      treesStanding: trees.length - fallen,
      treesFallen: fallen,
      flowersPlaced: flowers.length,
      flowerBloomTarget: foliageLevel(world.yearFrac),
    },
    fauna: {
      snakes: snakes.length,
      rats: rats.length,
      fish: fishes.length,
      butterfliesSpawned: butterflies.length,
      butterflyVisibility: computeButterflyVisibility(world, weather),
    },
    geology: {
      rocksSpawned: rocks.length,
      rocksStatic: rocks.length - displaced,
      rocksDisplaced: displaced,
    },
    atmosphere: {
      cloudBillboards: CLOUD_BILLBOARDS,
      rainParticles: PARTICLE_RAIN,
      hailParticles: PARTICLE_HAIL,
      snowParticles: PARTICLE_SNOW,
      tornadoDebrisParticles: TORNADO_DEBRIS,
    },
    player: { humans: 1 },
  };
}
