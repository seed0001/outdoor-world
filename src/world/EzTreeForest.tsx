import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Tree as EzTree } from "@dgreenheck/ez-tree";
import {
  trees as treeList,
  type TreeSpec,
} from "../systems/world/treeRegistry";
import { buildEzTree, disposeEzTreeTree } from "./ezTreeFactory";

const BUILDS_PER_FRAME = 2;

/**
 * Standing trees: procedural meshes from `@dgreenheck/ez-tree`, placed from the
 * deterministic `treeRegistry`. Built incrementally so the first frame stays responsive.
 */
export default function EzTreeForest({
  standingHiddenIds,
}: {
  standingHiddenIds: ReadonlySet<number>;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const queueRef = useRef<TreeSpec[] | null>(null);
  const builtRef = useRef<EzTree[]>([]);
  const hiddenRef = useRef(standingHiddenIds);

  hiddenRef.current = standingHiddenIds;

  useEffect(() => {
    queueRef.current = [...treeList];
    return () => {
      for (const t of builtRef.current) {
        disposeEzTreeTree(t);
        t.removeFromParent();
      }
      builtRef.current = [];
      queueRef.current = null;
    };
  }, []);

  useFrame((state) => {
    const root = rootRef.current;
    const q = queueRef.current;
    if (root && q && q.length > 0) {
      for (let i = 0; i < BUILDS_PER_FRAME; i++) {
        const spec = q.shift();
        if (!spec) break;
        const tree = buildEzTree(spec);
        root.add(tree);
        builtRef.current.push(tree);
      }
    }

    const elapsed = state.clock.elapsedTime;
    const hidden = hiddenRef.current;
    for (const tr of builtRef.current) {
      const id = tr.userData.treeId as number;
      const vis = !hidden.has(id);
      tr.visible = vis;
      if (vis) tr.update(elapsed);
    }
  });

  return <group ref={rootRef} />;
}
