import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { rocks as rockList, type RockSpec } from "../systems/world/rockRegistry";
import { mineralSampleColor } from "../systems/world/mineralRegistry";
import { worldState, type DisplacedRockPayload } from "../systems/world/worldState";

function rockMeshColor(spec: RockSpec): string {
  const s = spec.shade;
  const base = new THREE.Color(
    (150 * s) / 255,
    (145 * s) / 255,
    (135 * s) / 255,
  );
  const tint = new THREE.Color(mineralSampleColor(spec.mineralVein));
  base.lerp(tint, 0.2);
  return `#${base.getHexString()}`;
}

export default function Rocks() {
  const [displacedIds, setDisplacedIds] = useState<Set<number>>(new Set());
  const [displacedPayloads, setDisplacedPayloads] = useState<
    DisplacedRockPayload[]
  >([]);

  useEffect(() => {
    const sync = () => {
      const list = worldState.listDisplacedRocks();
      setDisplacedPayloads(list);
      setDisplacedIds(new Set(list.map((r) => r.id)));
    };
    sync();
    return worldState.subscribe(sync);
  }, []);

  return (
    <group>
      {rockList.map((r) => {
        if (displacedIds.has(r.id)) return null;
        return <StaticRock key={`static-${r.id}`} spec={r} />;
      })}
      {displacedPayloads.map((p) => (
        <DynamicRock key={`dyn-${p.id}`} payload={p} />
      ))}
    </group>
  );
}

function StaticRock({ spec }: { spec: RockSpec }) {
  const radius = spec.scale;
  const color = rockMeshColor(spec);
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[spec.x, spec.y + radius * 0.4, spec.z]}
      rotation={[spec.rx, spec.ry, spec.rz]}
      userData={{ kind: "rock", id: spec.id }}
    >
      <BallCollider args={[radius * 0.8]} />
      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[radius, 0]} />
        <meshStandardMaterial color={color} roughness={1} flatShading />
      </mesh>
    </RigidBody>
  );
}

function DynamicRock({ payload }: { payload: DisplacedRockPayload }) {
  const spec = rockList.find((r) => r.id === payload.id);
  const bodyRef = useRef<RapierRigidBody>(null);
  const appliedRef = useRef(false);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || appliedRef.current) return;
    appliedRef.current = true;
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
  const radius = payload.scale[0];
  const color = spec ? rockMeshColor(spec) : "#8a8274";
  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={payload.position}
      linearDamping={0.4}
      angularDamping={0.4}
      userData={{ kind: "rock", id: payload.id }}
    >
      <BallCollider args={[radius * 0.8]} />
      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[radius, 0]} />
        <meshStandardMaterial color={color} roughness={1} flatShading />
      </mesh>
    </RigidBody>
  );
}
