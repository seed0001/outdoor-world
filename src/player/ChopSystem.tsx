import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import type { Collider } from "@dimforge/rapier3d-compat";
import { playerRef, addCameraShake } from "../systems/player/playerRef";
import { health } from "../systems/player/health";
import { inventory } from "../systems/player/inventory";
import { snapshot } from "../systems/world/worldClock";
import { worldState } from "../systems/world/worldState";
import { computeWoodHarvestTraits } from "../systems/world/woodEcology";
import { trees as treeList } from "../systems/world/treeRegistry";
import { getWeather } from "../systems/weather/weatherSystem";
import { rocks as rockList } from "../systems/world/rockRegistry";
import { isBackpackOpen } from "../systems/ui/backpackState";
import { playMiningRockSfx, playWoodChopSfx } from "../systems/audio/gameAudio";
import { rayPickFauna } from "../systems/world/faunaPositions";
import { killFauna } from "../systems/world/faunaLifecycle";
import { handWorldPosition } from "./firstPersonHand";

const RAY_LEN = 4.2;
const CHOP_COOLDOWN = 0.48;
const STANDING_TREE_HITS = 4;
const FALLEN_TREE_HITS = 4;
const LOG_HITS = 3;
const BIG_STATIC_ROCK = 0.68;
const STATIC_ROCK_HITS = 4;
const DYNAMIC_ROCK_HITS = 3;

type HitKind = "tree" | "fallenTree" | "worldLog" | "rock";

function choppablePredicate(collider: Collider) {
  const rb = collider.parent();
  if (!rb) return false;
  const k = (rb.userData as { kind?: string } | undefined)?.kind;
  return (
    k === "tree" ||
    k === "fallenTree" ||
    k === "worldLog" ||
    k === "rock"
  );
}

export default function ChopSystem() {
  const { camera } = useThree();
  const { rapier, world } = useRapier();
  const dir = useRef(new THREE.Vector3());
  const origin = useRef(new THREE.Vector3());
  const cooldown = useRef(0);
  const mouseDown = useRef(false);
  const wasDown = useRef(false);

  const treeChops = useRef(new Map<number, number>());
  const fallenChops = useRef(new Map<number, number>());
  const logChops = useRef(new Map<number, number>());
  const staticRockChops = useRef(new Map<number, number>());
  const dynamicRockChops = useRef(new Map<number, number>());

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button === 0) mouseDown.current = true;
    };
    const up = (e: MouseEvent) => {
      if (e.button === 0) mouseDown.current = false;
    };
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  useFrame((_, dt) => {
    cooldown.current = Math.max(0, cooldown.current - dt);

    const locked = !!document.pointerLockElement;
    const pressed = mouseDown.current && locked && !health.get().dead;
    const edge = pressed && !wasDown.current;
    wasDown.current = pressed;

    if (!edge || cooldown.current > 0) return;
    if (isBackpackOpen()) return;

    cooldown.current = CHOP_COOLDOWN;

    const rb = playerRef.body;
    if (!rb) return;

    camera.getWorldDirection(dir.current);
    const o = origin.current;
    handWorldPosition(camera, o);

    const faunaHit = rayPickFauna(
      o.x,
      o.y,
      o.z,
      dir.current.x,
      dir.current.y,
      dir.current.z,
      RAY_LEN,
    );
    if (faunaHit && killFauna(faunaHit.kind, faunaHit.id)) {
      playerRef.axeSwing = 1;
      addCameraShake(0.1);
      playWoodChopSfx();
      return;
    }

    const ray = new rapier.Ray(
      { x: o.x, y: o.y, z: o.z },
      { x: dir.current.x, y: dir.current.y, z: dir.current.z },
    );

    const hit = world.castRay(
      ray,
      RAY_LEN,
      true,
      undefined,
      undefined,
      undefined,
      rb,
      choppablePredicate,
    );

    playerRef.axeSwing = 1;
    addCameraShake(0.08);

    if (!hit) return;

    const parent = hit.collider.parent();
    if (!parent) return;
    const raw = parent.userData;
    if (!raw || typeof raw !== "object") return;
    const ud = raw as { kind?: HitKind; id?: number; logId?: number };
    const kind = ud.kind;

    if (kind === "tree" && typeof ud.id === "number") {
      const id = ud.id;
      if (worldState.isTreeFallen(id) || worldState.isTreeHarvestedToLog(id)) return;
      playWoodChopSfx();
      const n = (treeChops.current.get(id) ?? 0) + 1;
      treeChops.current.set(id, n);
      addCameraShake(0.06);
      if (n >= STANDING_TREE_HITS) {
        treeChops.current.delete(id);
        const t = treeList.find((x) => x.id === id);
        if (!t) return;
        const hl = Math.max(0.45, t.trunkHeight * 0.45);
        const ht = Math.max(0.1, t.trunkRadius * 0.55);
        worldState.harvestStandingTreeToLog(id, {
          position: [t.x, t.y + ht * 0.5, t.z],
          rotation: [0, t.rot, 0],
          halfLength: hl,
          halfThickness: ht,
          treeKind: t.kind,
        });
      }
      return;
    }

    if (kind === "fallenTree" && typeof ud.id === "number") {
      const id = ud.id;
      playWoodChopSfx();
      const n = (fallenChops.current.get(id) ?? 0) + 1;
      fallenChops.current.set(id, n);
      addCameraShake(0.07);
      if (n >= FALLEN_TREE_HITS) {
        fallenChops.current.delete(id);
        const tr = parent.translation();
        const hl = 0.85;
        const ht = 0.14;
        worldState.convertFallenTreeToLog(id, [tr.x, tr.y, tr.z], {
          rotation: [0, playerRef.heading, 0],
          halfLength: hl,
          halfThickness: ht,
        });
      }
      return;
    }

    if (kind === "worldLog" && typeof ud.logId === "number") {
      const logId = ud.logId;
      playWoodChopSfx();
      const n = (logChops.current.get(logId) ?? 0) + 1;
      logChops.current.set(logId, n);
      addCameraShake(0.07);
      if (n >= LOG_HITS) {
        logChops.current.delete(logId);
        const logPayload = worldState.listPlacedLogs().find((l) => l.id === logId);
        worldState.removePlacedLog(logId);
        const w = getWeather();
        const traits = logPayload
          ? computeWoodHarvestTraits(logPayload.treeKind, snapshot(), {
              elevation: playerRef.position.y,
              weatherTempMod: w.tempMod,
            })
          : null;
        let sticks = 4 + Math.floor(Math.random() * 3);
        if (traits && traits.refinement > 0.78) sticks += 1;
        if (traits && traits.freshness > 0.88) sticks += 1;
        inventory.add("stick", Math.min(sticks, 12));
      }
      return;
    }

    if (kind === "rock" && typeof ud.id === "number") {
      const rockId = ud.id;
      const spec = rockList.find((r) => r.id === rockId);
      const isDisplaced = worldState.isRockDisplaced(rockId);

      if (!isDisplaced && spec && spec.scale >= BIG_STATIC_ROCK) {
        const n = (staticRockChops.current.get(rockId) ?? 0) + 1;
        staticRockChops.current.set(rockId, n);
        playMiningRockSfx();
        addCameraShake(0.09);
        if (n >= STATIC_ROCK_HITS) {
          staticRockChops.current.delete(rockId);
          const dirX = dir.current.x;
          const dirZ = dir.current.z;
          const h = Math.hypot(dirX, dirZ) || 1;
          const nx = dirX / h;
          const nz = dirZ / h;
          const now = performance.now();
          worldState.displaceRock({
            id: rockId,
            position: [spec.x, spec.y + spec.scale * 0.45, spec.z],
            scale: [spec.scale * 0.55, spec.scale * 0.55, spec.scale * 0.55],
            initialImpulse: [nx * 8, 14, nz * 8],
            angularImpulse: [
              (Math.random() - 0.5) * 6,
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.5) * 6,
            ],
            spawnSimMs: now,
          });
          worldState.addStonePickupsAround(
            [spec.x, spec.y + 0.2, spec.z],
            4,
            0.55,
            { mineralVein: spec.mineralVein },
          );
        }
        return;
      }

      if (isDisplaced) {
        const payload = worldState
          .listDisplacedRocks()
          .find((p) => p.id === rockId);
        const rad = payload?.scale[0] ?? 0;
        if (rad < 0.32) return;

        const n = (dynamicRockChops.current.get(rockId) ?? 0) + 1;
        dynamicRockChops.current.set(rockId, n);
        playMiningRockSfx();
        addCameraShake(0.08);
        if (n >= DYNAMIC_ROCK_HITS) {
          dynamicRockChops.current.delete(rockId);
          const tr = parent.translation();
          worldState.removeDisplacedRock(rockId);
          worldState.addStonePickupsAround(
            [tr.x, tr.y + 0.1, tr.z],
            3,
            0.45,
            spec ? { mineralVein: spec.mineralVein } : undefined,
          );
        }
      }
    }
  });

  return null;
}
