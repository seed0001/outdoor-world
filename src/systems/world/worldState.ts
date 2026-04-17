import * as THREE from "three";

export interface FallenTreePayload {
  id: number;
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

const fallenTrees = new Map<number, FallenTreePayload>();
const displacedRocks = new Map<number, DisplacedRockPayload>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const worldState = {
  fellTree(p: FallenTreePayload) {
    if (fallenTrees.has(p.id)) return;
    fallenTrees.set(p.id, p);
    emit();
  },
  displaceRock(p: DisplacedRockPayload) {
    if (displacedRocks.has(p.id)) return;
    displacedRocks.set(p.id, p);
    emit();
  },
  isTreeFallen(id: number) {
    return fallenTrees.has(id);
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
  reset() {
    fallenTrees.clear();
    displacedRocks.clear();
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
