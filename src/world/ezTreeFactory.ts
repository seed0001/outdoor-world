import * as THREE from "three";
import { Tree, TreePreset } from "@dgreenheck/ez-tree";
import type { TreeKind, TreeSpec } from "../systems/world/treeRegistry";
import { TREE_PLACEMENT_SEED } from "../systems/world/worldSeed";

const PRESET_NAMES: Record<TreeKind, string> = {
  0: "Oak Medium",
  1: "Pine Medium",
  2: "Aspen Medium",
  3: "Ash Medium",
};

/** Stable per-tree seed so the same id always yields the same ez-tree shape. */
export function ezTreeSeedForSpec(spec: TreeSpec): number {
  return ((spec.id * 2654435761 + TREE_PLACEMENT_SEED) >>> 0) % 2147483647;
}

function applyLeafBudget(tree: Tree): void {
  const leaves = tree.options.leaves as { count?: number };
  if (typeof leaves.count === "number") {
    leaves.count = Math.max(8, Math.floor(leaves.count * 0.55));
  }
}

/**
 * Procedural [ez-tree](https://github.com/dgreenheck/ez-tree) mesh scaled to match
 * registry dimensions for physics / chop logic.
 */
export function buildEzTree(spec: TreeSpec): Tree {
  const tree = new Tree();
  const presetName = PRESET_NAMES[spec.kind];
  const raw = TreePreset[presetName];
  if (raw == null || typeof raw !== "object") {
    throw new Error(`ez-tree: missing preset "${presetName}"`);
  }
  tree.options.copy(raw);
  tree.options.seed = ezTreeSeedForSpec(spec);
  applyLeafBudget(tree);
  tree.generate();
  tree.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(tree);
  const size = new THREE.Vector3();
  box.getSize(size);
  const targetH = spec.trunkHeight + spec.foliageHeight * 0.92;
  /** Visual scale vs registry height — higher = bigger on screen (colliders unchanged). */
  const VISUAL_SCALE = 0.92;
  const scale =
    (targetH / Math.max(size.y, 0.001)) * spec.scale * VISUAL_SCALE;
  tree.scale.setScalar(scale);
  tree.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(tree);
  tree.position.set(spec.x, spec.y - box2.min.y, spec.z);
  tree.rotation.y = spec.rot;
  tree.userData.treeId = spec.id;
  tree.frustumCulled = false;
  return tree;
}

export function disposeEzTreeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}
