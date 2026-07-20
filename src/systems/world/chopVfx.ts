import * as THREE from "three";

export type ChopTargetKind = "tree" | "fallenTree" | "worldLog" | "rock";

export type StrikeMaterial = "wood" | "stone";

export type ChopGash = {
  id: number;
  targetKey: string;
  material: StrikeMaterial;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  width: number;
  height: number;
  depth: number;
};

export type WoodChipParticle = {
  active: boolean;
  material: StrikeMaterial;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  angularVel: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
  life: number;
  maxLife: number;
};

const WOOD_CHIP_COLORS = ["#6b4a2a", "#8b6a3a", "#5c3a1a", "#a08050", "#4a3018"];
const STONE_CHIP_COLORS = ["#8a8274", "#6e6a62", "#a09888", "#5c5850", "#9a9080"];

let nextGashId = 1;
const gashes: ChopGash[] = [];
const chips: WoodChipParticle[] = [];
const listeners = new Set<() => void>();

const treeShakes = new Map<number, { untilMs: number; intensity: number }>();

const _normal = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _scratch = new THREE.Vector3();
const _obj = new THREE.Object3D();

function emit() {
  listeners.forEach((cb) => cb());
}

function targetKey(kind: ChopTargetKind, id: number): string {
  return `${kind}:${id}`;
}

function buildGashQuaternion(normal: THREE.Vector3): THREE.Quaternion {
  _normal.copy(normal).normalize();
  _tangent.set(0, 1, 0);
  if (Math.abs(_normal.dot(_tangent)) > 0.85) _tangent.set(1, 0, 0);
  _bitangent.crossVectors(_normal, _tangent).normalize();
  _tangent.crossVectors(_bitangent, _normal).normalize();

  _obj.position.set(0, 0, 0);
  _scratch.copy(_normal);
  _obj.lookAt(_scratch);
  _obj.rotateZ((Math.random() - 0.5) * 0.9 + (Math.random() < 0.5 ? -0.55 : 0.55));
  return _obj.quaternion.clone();
}

function allocChip(): WoodChipParticle | null {
  const free = chips.find((c) => !c.active);
  if (free) return free;
  if (chips.length >= 96) return null;
  const c: WoodChipParticle = {
    active: false,
    material: "wood",
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    angularVel: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    scale: 1,
    life: 0,
    maxLife: 1,
  };
  chips.push(c);
  return c;
}

function spawnChips(
  hitPoint: THREE.Vector3,
  normal: THREE.Vector3,
  count: number,
  material: StrikeMaterial,
) {
  for (let i = 0; i < count; i++) {
    const slot = allocChip();
    if (!slot) break;

    _scratch
      .set((Math.random() - 0.5) * 1.4, Math.random() * 0.6 + 0.25, (Math.random() - 0.5) * 1.4)
      .add(normal)
      .normalize();

    const speed =
      material === "stone"
        ? 2.8 + Math.random() * 4.8
        : 2.2 + Math.random() * 4.2;
    slot.active = true;
    slot.material = material;
    slot.position.copy(hitPoint).addScaledVector(normal, 0.03 + Math.random() * 0.02);
    slot.velocity.copy(_scratch).multiplyScalar(speed);
    slot.angularVel.set(
      (Math.random() - 0.5) * (material === "stone" ? 18 : 14),
      (Math.random() - 0.5) * (material === "stone" ? 18 : 14),
      (Math.random() - 0.5) * (material === "stone" ? 18 : 14),
    );
    slot.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    slot.scale =
      material === "stone"
        ? 0.02 + Math.random() * 0.04
        : 0.025 + Math.random() * 0.045;
    slot.maxLife = material === "stone" ? 0.35 + Math.random() * 0.4 : 0.4 + Math.random() * 0.45;
    slot.life = slot.maxLife;
  }
}

function strikeMaterial(kind: ChopTargetKind): StrikeMaterial {
  return kind === "rock" ? "stone" : "wood";
}

export function reportChopHit(payload: {
  kind: ChopTargetKind;
  targetId: number;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  hitIndex: number;
  maxHits: number;
}): void {
  const material = strikeMaterial(payload.kind);
  _normal.copy(payload.direction).normalize().negate();

  const progress = payload.hitIndex / payload.maxHits;
  const width =
    material === "stone"
      ? 0.12 + progress * 0.16 + Math.random() * 0.05
      : 0.18 + progress * 0.22 + Math.random() * 0.06;
  const height = material === "stone" ? 0.05 + progress * 0.03 : 0.06 + progress * 0.04;
  const depth = material === "stone" ? 0.022 + progress * 0.01 : 0.018 + progress * 0.012;

  gashes.push({
    id: nextGashId++,
    targetKey: targetKey(payload.kind, payload.targetId),
    material,
    position: payload.position.clone().addScaledVector(_normal, 0.015),
    quaternion: buildGashQuaternion(_normal),
    width,
    height,
    depth,
  });

  const chipCount =
    material === "stone"
      ? 8 + Math.floor(Math.random() * 7) + Math.floor(progress * 5)
      : 6 + Math.floor(Math.random() * 6) + Math.floor(progress * 4);
  spawnChips(payload.position, _normal, chipCount, material);

  if (payload.kind === "tree") {
    treeShakes.set(payload.targetId, {
      untilMs: performance.now() + 220,
      intensity: 0.035 + progress * 0.025,
    });
  }

  emit();
}

export function listGashes(): readonly ChopGash[] {
  return gashes;
}

export function listChips(): readonly WoodChipParticle[] {
  return chips;
}

export function getTreeShake(treeId: number, nowMs: number): number {
  const s = treeShakes.get(treeId);
  if (!s || nowMs > s.untilMs) {
    treeShakes.delete(treeId);
    return 0;
  }
  const t = 1 - (s.untilMs - nowMs) / 220;
  return s.intensity * (1 - t) * Math.sin(t * Math.PI * 3.5);
}

export function tickChopChips(dt: number): void {
  const gravity = -18;
  for (const c of chips) {
    if (!c.active) continue;
    c.life -= dt;
    if (c.life <= 0) {
      c.active = false;
      continue;
    }
    c.velocity.y += gravity * dt;
    c.position.addScaledVector(c.velocity, dt);
    c.rotation.x += c.angularVel.x * dt;
    c.rotation.y += c.angularVel.y * dt;
    c.rotation.z += c.angularVel.z * dt;
    c.velocity.multiplyScalar(1 - dt * 2.8);
  }
}

export function pruneGashesForRemovedTargets(
  fallenIds: ReadonlySet<number>,
  harvestedIds: ReadonlySet<number>,
  logIds: ReadonlySet<number>,
  activeRockIds: ReadonlySet<number>,
): void {
  let changed = false;
  for (let i = gashes.length - 1; i >= 0; i--) {
    const g = gashes[i];
    const colon = g.targetKey.indexOf(":");
    const kind = g.targetKey.slice(0, colon);
    const id = Number(g.targetKey.slice(colon + 1));
    let remove = false;
    if (kind === "tree" && (harvestedIds.has(id) || fallenIds.has(id))) remove = true;
    if (kind === "fallenTree" && !fallenIds.has(id)) remove = true;
    if (kind === "worldLog" && !logIds.has(id)) remove = true;
    if (kind === "rock" && !activeRockIds.has(id)) remove = true;
    if (remove) {
      gashes.splice(i, 1);
      changed = true;
    }
  }
  if (changed) emit();
}

export function resetChopVfx(): void {
  gashes.length = 0;
  for (const c of chips) c.active = false;
  treeShakes.clear();
  emit();
}

export function subscribeChopVfx(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function chipColor(material: StrikeMaterial, index: number): string {
  const palette = material === "stone" ? STONE_CHIP_COLORS : WOOD_CHIP_COLORS;
  return palette[index % palette.length];
}
