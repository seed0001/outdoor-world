import { useEffect, useState } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import {
  worldState,
  type PlacedLogPayload,
} from "../systems/world/worldState";

export default function Logs() {
  const [logs, setLogs] = useState<PlacedLogPayload[]>(() =>
    worldState.listPlacedLogs(),
  );

  useEffect(() => {
    const sync = () => setLogs(worldState.listPlacedLogs());
    sync();
    return worldState.subscribe(sync);
  }, []);

  return (
    <group>
      {logs.map((log) => (
        <PlacedLog key={`log-${log.id}`} log={log} />
      ))}
    </group>
  );
}

function PlacedLog({ log }: { log: PlacedLogPayload }) {
  const { halfLength, halfThickness } = log;
  return (
    <RigidBody
      type="dynamic"
      colliders={false}
      position={log.position}
      rotation={log.rotation}
      linearDamping={0.5}
      angularDamping={0.6}
      canSleep
      userData={{ kind: "worldLog", logId: log.id }}
    >
      <CuboidCollider args={[halfLength, halfThickness, halfThickness]} />
      <mesh castShadow receiveShadow>
        <boxGeometry
          args={[halfLength * 2, halfThickness * 2, halfThickness * 2]}
        />
        <meshStandardMaterial color="#5c3a1a" roughness={0.92} />
      </mesh>
    </RigidBody>
  );
}
