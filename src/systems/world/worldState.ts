import * as THREE from "three";
import type { TreeKind } from "./treeRegistry";
import type { MineralKind } from "./mineralRegistry";

export interface WorldStateSaveData {
  fallenTrees: FallenTreePayload[];
  displacedRocks: DisplacedRockPayload[];
  treesHarvestedToLog: number[];
  placedLogs: PlacedLogPayload[];
  stonePickups: StonePickupPayload[];
  arrowPickups: ArrowPickupPayload[];
  nextLogId: number;
  nextPickupId: number;
  nextArrowPickupId: number;
}

export interface FallenTreePayload {
  id: number;
  kind: TreeKind;
  position: [number, number, number];
  trunkHeight: number;
  trunkRadius: number;
  foliageHeight: number;
  foliageRadius: number;
  initialImpulse: [number, number, number];
  angularImpulse: [number, number, number];
  spawnSimMs: number;
}

export interface DisplacedRockPayload {
  id: number;
  position: [number, number, number];
  scale: [number, number, number];
  initialImpulse: [number, number, number];
  angularImpulse: [number, number, number];
  spawnSimMs: number;
}

/** Player-felled standing tree → world log (instanced tree hidden). */
export interface PlacedLogPayload {
  id: number;
  position: [number, number, number];
  rotation: [number, number, number];
  halfLength: number;
  halfThickness: number;
  /** Species — drives `woodEcology` traits when the log is processed or split. */
  treeKind: TreeKind;
}

export interface StonePickupPayload {
  id: number;
  position: [number, number, number];
  stones: number;
  /** Extra yields from the rock’s mineral vein (see `rockRegistry`). */
  minerals: Partial<Record<MineralKind, number>>;
}

/** Dropped / shot arrow — quaternion matches the GLB orientation on the ground. */
export interface ArrowPickupPayload {
  id: number;
  position: [number, number, number];
  rotation: [number, number, number, number];
}

const fallenTrees = new Map<number, FallenTreePayload>();
const displacedRocks = new Map<number, DisplacedRockPayload>();
/** Standing trees removed for a placed log. */
const treesHarvestedToLog = new Set<number>();
const placedLogs = new Map<number, PlacedLogPayload>();
const stonePickups = new Map<number, StonePickupPayload>();
const arrowPickups = new Map<number, ArrowPickupPayload>();
let nextLogId = 1;
let nextPickupId = 1;
let nextArrowPickupId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const worldState = {
  fellTree(p: FallenTreePayload) {
    if (fallenTrees.has(p.id)) return;
    if (treesHarvestedToLog.has(p.id)) return;
    fallenTrees.set(p.id, p);
    emit();
  },
  displaceRock(p: DisplacedRockPayload) {
    if (displacedRocks.has(p.id)) return;
    displacedRocks.set(p.id, p);
    emit();
  },
  removeFallenTree(id: number) {
    if (!fallenTrees.delete(id)) return;
    emit();
  },
  /** Standing tree → log; hides instanced tree + collider. */
  harvestStandingTreeToLog(treeId: number, log: Omit<PlacedLogPayload, "id">) {
    if (treesHarvestedToLog.has(treeId)) return;
    treesHarvestedToLog.add(treeId);
    const id = nextLogId++;
    placedLogs.set(id, { id, ...log });
    emit();
  },
  /** Fallen tornado tree removed and replaced by a log at `position`. */
  convertFallenTreeToLog(treeId: number, position: [number, number, number], logRest: Omit<PlacedLogPayload, "id" | "position" | "treeKind">) {
    const fallen = fallenTrees.get(treeId);
    if (!fallen) return;
    fallenTrees.delete(treeId);
    const id = nextLogId++;
    placedLogs.set(id, { id, position, ...logRest, treeKind: fallen.kind });
    emit();
  },
  removePlacedLog(logId: number) {
    if (!placedLogs.delete(logId)) return;
    emit();
  },
  addStonePickupsAround(
    origin: [number, number, number],
    count: number,
    spread: number,
    opts?: { mineralVein?: MineralKind },
  ) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.15 + Math.random() * spread;
      const id = nextPickupId++;
      const stones = 1 + Math.floor(Math.random() * 2);
      const minerals: Partial<Record<MineralKind, number>> = {};
      const vein = opts?.mineralVein;
      if (vein !== undefined) {
        const n = 1 + Math.floor(Math.random() * 2);
        const bonus = Math.random() < 0.38 ? 1 : 0;
        minerals[vein] = n + bonus;
      }
      stonePickups.set(id, {
        id,
        position: [
          origin[0] + Math.cos(a) * r,
          origin[1] + 0.25,
          origin[2] + Math.sin(a) * r,
        ],
        stones,
        minerals,
      });
    }
    emit();
  },
  removeStonePickup(id: number) {
    if (!stonePickups.delete(id)) return;
    emit();
  },
  addArrowPickup(p: Omit<ArrowPickupPayload, "id">) {
    const id = nextArrowPickupId++;
    arrowPickups.set(id, { id, ...p });
    emit();
  },
  removeArrowPickup(id: number) {
    if (!arrowPickups.delete(id)) return;
    emit();
  },
  removeDisplacedRock(rockId: number) {
    if (!displacedRocks.delete(rockId)) return;
    emit();
  },
  isTreeFallen(id: number) {
    return fallenTrees.has(id);
  },
  isTreeHarvestedToLog(id: number) {
    return treesHarvestedToLog.has(id);
  },
  isRockDisplaced(id: number) {
    return displacedRocks.has(id);
  },
  listFallenTrees(): FallenTreePayload[] {
    return Array.from(fallenTrees.values());
  },
  listDisplacedRocks(): DisplacedRockPayload[] {
    return Array.from(displacedRocks.values());
  },
  listPlacedLogs(): PlacedLogPayload[] {
    return Array.from(placedLogs.values());
  },
  listStonePickups(): StonePickupPayload[] {
    return Array.from(stonePickups.values());
  },
  listArrowPickups(): ArrowPickupPayload[] {
    return Array.from(arrowPickups.values());
  },
  listTreesHarvestedToLog(): number[] {
    return Array.from(treesHarvestedToLog);
  },
  reset() {
    fallenTrees.clear();
    displacedRocks.clear();
    treesHarvestedToLog.clear();
    placedLogs.clear();
    stonePickups.clear();
    arrowPickups.clear();
    nextLogId = 1;
    nextPickupId = 1;
    nextArrowPickupId = 1;
    emit();
  },
  getSaveData(): WorldStateSaveData {
    return {
      fallenTrees: Array.from(fallenTrees.values()),
      displacedRocks: Array.from(displacedRocks.values()),
      treesHarvestedToLog: Array.from(treesHarvestedToLog),
      placedLogs: Array.from(placedLogs.values()),
      stonePickups: Array.from(stonePickups.values()),
      arrowPickups: Array.from(arrowPickups.values()),
      nextLogId,
      nextPickupId,
      nextArrowPickupId,
    };
  },
  restoreSaveData(data: WorldStateSaveData): void {
    fallenTrees.clear();
    displacedRocks.clear();
    treesHarvestedToLog.clear();
    placedLogs.clear();
    stonePickups.clear();
    arrowPickups.clear();
    for (const p of data.fallenTrees) fallenTrees.set(p.id, p);
    for (const p of data.displacedRocks) displacedRocks.set(p.id, p);
    for (const id of data.treesHarvestedToLog) treesHarvestedToLog.add(id);
    for (const p of data.placedLogs) placedLogs.set(p.id, p);
    for (const p of data.stonePickups) stonePickups.set(p.id, p);
    for (const p of data.arrowPickups) arrowPickups.set(p.id, p);
    nextLogId = data.nextLogId;
    nextPickupId = data.nextPickupId;
    nextArrowPickupId = data.nextArrowPickupId;
    emit();
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

export const TMP_VEC = new THREE.Vector3();
