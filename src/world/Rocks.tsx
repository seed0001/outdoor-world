import { useEffect, useRef, useState } from "react";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { rocks as rockList, type RockSpec } from "../systems/world/rockRegistry";
import { worldState, type DisplacedRockPayload } from "../systems/world/worldState";

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
  const color = `rgb(${Math.round(150 * spec.shade)}, ${Math.round(
    145 * spec.shade,
  )}, ${Math.round(135 * spec.shade)})`;
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
  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={payload.position}
      linearDamping={0.4}
      angularDamping={0.4}
    >
      <BallCollider args={[radius * 0.8]} />
      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[radius, 0]} />
        <meshStandardMaterial color="#8a8274" roughness={1} flatShading />
      </mesh>
    </RigidBody>
  );
}
