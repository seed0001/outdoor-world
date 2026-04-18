import { useEffect, useRef, useState } from "react";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { worldState, type FallenTreePayload } from "../systems/world/worldState";
import { trees as treeList } from "../systems/world/treeRegistry";
import EzTreeForest from "./EzTreeForest";

const TRUNK_COLORS = ["#4a2b14", "#2d1a0c", "#c8b8a8", "#3d2818"] as const;

export default function Trees() {
  const [standingHiddenIds, setStandingHiddenIds] = useState<Set<number>>(
    new Set(),
  );
  const [fallenPayloads, setFallenPayloads] = useState<FallenTreePayload[]>(
    [],
  );

  useEffect(() => {
    const sync = () => {
      const payloads = worldState.listFallenTrees();
      setFallenPayloads(payloads);
      const hidden = new Set<number>();
      for (const p of payloads) hidden.add(p.id);
      for (const id of worldState.listTreesHarvestedToLog()) hidden.add(id);
      setStandingHiddenIds(hidden);
    };
    sync();
    return worldState.subscribe(sync);
  }, []);

  return (
    <group>
      <EzTreeForest standingHiddenIds={standingHiddenIds} />

      {treeList.map((t) => {
        if (standingHiddenIds.has(t.id)) return null;
        return (
          <RigidBody
            key={`col-${t.id}`}
            type="fixed"
            colliders={false}
            position={[t.x, t.y + t.trunkHeight / 2, t.z]}
            userData={{ kind: "tree", id: t.id }}
          >
            <CylinderCollider
              args={[t.trunkHeight / 2, t.trunkRadius]}
            />
          </RigidBody>
        );
      })}

      {fallenPayloads.map((p) => (
        <FallenTree key={`fallen-${p.id}`} payload={p} />
      ))}
    </group>
  );
}

function FallenTree({ payload }: { payload: FallenTreePayload }) {
  const bodyRef = useRef<import("@react-three/rapier").RapierRigidBody>(null);
  const hasImpulsedRef = useRef(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || hasImpulsedRef.current) return;
    hasImpulsedRef.current = true;
    body.applyImpulse(
      {
        x: payload.initialImpulse[0],
        y: payload.initialImpulse[1],
        z: payload.initialImpulse[2],
      },
      true,
    );
    body.applyTorqueImpulse(
      {
        x: payload.angularImpulse[0],
        y: payload.angularImpulse[1],
        z: payload.angularImpulse[2],
      },
      true,
    );
  }, [payload]);

  const totalHeight = payload.trunkHeight + payload.foliageHeight;
  const k = payload.kind;
  const trunkColor = TRUNK_COLORS[k] ?? TRUNK_COLORS[0];
  const foliageColor = "#4a5d2b";

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={[
        payload.position[0],
        payload.position[1] + totalHeight / 2,
        payload.position[2],
      ]}
      linearDamping={0.3}
      angularDamping={0.3}
      userData={{ kind: "fallenTree", id: payload.id }}
    >
      <CylinderCollider
        args={[totalHeight / 2, Math.max(payload.trunkRadius, 0.4)]}
      />
      <group>
        <mesh castShadow receiveShadow position={[0, -payload.foliageHeight / 2, 0]}>
          <cylinderGeometry
            args={[
              payload.trunkRadius * 0.7,
              payload.trunkRadius,
              payload.trunkHeight,
              8,
            ]}
          />
          <meshStandardMaterial color={trunkColor} roughness={0.95} />
        </mesh>
        <mesh
          castShadow
          receiveShadow
          position={[0, payload.trunkHeight / 2, 0]}
          scale={
            k === 3
              ? [
                  payload.foliageRadius,
                  payload.foliageHeight * 0.48,
                  payload.foliageRadius,
                ]
              : [1, 1, 1]
          }
        >
          {k === 3 ? (
            <icosahedronGeometry args={[1, 1]} />
          ) : (
            <coneGeometry
              args={[
                payload.foliageRadius,
                payload.foliageHeight,
                k === 1 ? 10 : 8,
              ]}
            />
          )}
          <meshStandardMaterial color={foliageColor} roughness={1} />
        </mesh>
      </group>
    </RigidBody>
  );
}
