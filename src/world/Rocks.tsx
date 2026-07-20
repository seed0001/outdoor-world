import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import {
  formationRocks,
  scatterRocks,
  type RockSpec,
} from "../systems/world/rockRegistry";
import { mineralSampleColor } from "../systems/world/mineralRegistry";
import { worldState, type DisplacedRockPayload } from "../systems/world/worldState";

function rockMeshColor(spec: RockSpec): string {
  if (spec.role === "formation" && spec.formationColor) {
    const [r, g, b] = spec.formationColor;
    return `#${new THREE.Color(r, g, b).getHexString()}`;
  }
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
  const [minedIds, setMinedIds] = useState<Set<number>>(new Set());
  const [displacedPayloads, setDisplacedPayloads] = useState<
    DisplacedRockPayload[]
  >([]);

  useEffect(() => {
    const sync = () => {
      const list = worldState.listDisplacedRocks();
      setDisplacedPayloads(list);
      setDisplacedIds(new Set(list.map((r) => r.id)));
      setMinedIds(new Set(worldState.listMinedRocks()));
    };
    sync();
    return worldState.subscribe(sync);
  }, []);

  return (
    <group>
      {scatterRocks.map((r) => {
        if (displacedIds.has(r.id) || minedIds.has(r.id)) return null;
        return <ScatterRock key={`scatter-${r.id}`} spec={r} />;
      })}
      {formationRocks.map((r) => (
        <FormationRock key={`formation-${r.id}`} spec={r} />
      ))}
      {displacedPayloads.map((p) => (
        <DynamicRock key={`dyn-${p.id}`} payload={p} />
      ))}
    </group>
  );
}

function ScatterRock({ spec }: { spec: RockSpec }) {
  const radius = spec.scale;
  const color = rockMeshColor(spec);
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[spec.x, spec.y + radius * 0.4, spec.z]}
      rotation={[spec.rx, spec.ry, spec.rz]}
      friction={1}
      userData={{ kind: "rock", id: spec.id }}
    >
      <BallCollider args={[radius * 0.92]} />
      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[radius, 0]} />
        <meshStandardMaterial color={color} roughness={1} flatShading />
      </mesh>
    </RigidBody>
  );
}

function FormationRock({ spec }: { spec: RockSpec }) {
  const radius = spec.scale;
  const color = rockMeshColor(spec);
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[spec.x, spec.y + radius * 0.38, spec.z]}
      rotation={[spec.rx, spec.ry, spec.rz]}
      friction={1.1}
      userData={{ kind: "formationRock", id: spec.id }}
    >
      <BallCollider args={[radius * 0.98]} />
      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[radius, 1]} />
        <meshStandardMaterial color={color} roughness={1} flatShading />
      </mesh>
    </RigidBody>
  );
}

function DynamicRock({ payload }: { payload: DisplacedRockPayload }) {
  const spec = scatterRocks.find((r) => r.id === payload.id);
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
      friction={1}
      userData={{ kind: "rock", id: payload.id }}
    >
      <BallCollider args={[radius * 0.92]} />
      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[radius, 0]} />
        <meshStandardMaterial color={color} roughness={1} flatShading />
      </mesh>
    </RigidBody>
  );
}
