import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import type { Collider } from "@dimforge/rapier3d-compat";
import { playerRef } from "../systems/player/playerRef";
import { health } from "../systems/player/health";
import { isBackpackOpen } from "../systems/ui/backpackState";
import {
  getTreeInspectEnabled,
  setTreeInspectTarget,
} from "../systems/ui/treeInspectState";
import { worldState } from "../systems/world/worldState";

/** Only show the popup when the trunk is within this ray length (world units). */
const INSPECT_RAY_LEN = 3.05;

function inspectPredicate(collider: Collider) {
  const rb = collider.parent();
  if (!rb) return false;
  const k = (rb.userData as { kind?: string } | undefined)?.kind;
  return k === "tree" || k === "fallenTree";
}

/**
 * Raycasts along the camera each frame; when pointer-locked and aimed at a tree
 * within {@link INSPECT_RAY_LEN}, updates {@link treeInspectState}.
 */
export default function TreeInspectRay() {
  const { camera } = useThree();
  const { rapier, world } = useRapier();
  const dir = useRef(new THREE.Vector3());
  const origin = useRef(new THREE.Vector3());

  useFrame(() => {
    if (
      !getTreeInspectEnabled() ||
      !document.pointerLockElement ||
      health.get().dead ||
      isBackpackOpen()
    ) {
      setTreeInspectTarget(null);
      return;
    }
    const rb = playerRef.body;
    if (!rb) {
      setTreeInspectTarget(null);
      return;
    }

    camera.getWorldDirection(dir.current);
    const o = origin.current;
    o.copy(camera.position).addScaledVector(dir.current, 0.35);

    const ray = new rapier.Ray(
      { x: o.x, y: o.y, z: o.z },
      { x: dir.current.x, y: dir.current.y, z: dir.current.z },
    );

    const hit = world.castRay(
      ray,
      INSPECT_RAY_LEN,
      true,
      undefined,
      undefined,
      undefined,
      rb,
      inspectPredicate,
    );

    if (!hit) {
      setTreeInspectTarget(null);
      return;
    }

    const parent = hit.collider.parent();
    if (!parent) {
      setTreeInspectTarget(null);
      return;
    }
    const raw = parent.userData;
    if (!raw || typeof raw !== "object") {
      setTreeInspectTarget(null);
      return;
    }
    const ud = raw as { kind?: string; id?: number };
    if (typeof ud.id !== "number") {
      setTreeInspectTarget(null);
      return;
    }

    if (ud.kind === "tree") {
      if (
        worldState.isTreeFallen(ud.id) ||
        worldState.isTreeHarvestedToLog(ud.id)
      ) {
        setTreeInspectTarget(null);
        return;
      }
      setTreeInspectTarget({ mode: "standing", treeId: ud.id });
      return;
    }
    if (ud.kind === "fallenTree") {
      setTreeInspectTarget({ mode: "fallen", treeId: ud.id });
      return;
    }

    setTreeInspectTarget(null);
  });

  return null;
}
