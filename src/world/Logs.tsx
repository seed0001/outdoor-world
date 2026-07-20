import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import {
  worldState,
  type PlacedLogPayload,
} from "../systems/world/worldState";

const LOG_URL = "/models/quaternius_cc0-wood-log-1520.glb";

useGLTF.preload(LOG_URL);

/** Align long axis to +X and normalize uniformly (preserves model proportions). */
function buildLogTemplate(scene: THREE.Object3D): THREE.Object3D {
  const clone = SkeletonUtils.clone(scene);
  clone.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  clone.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);

  if (size.y >= size.x && size.y >= size.z) {
    clone.rotation.z = Math.PI / 2;
  } else if (size.z >= size.x && size.z >= size.y) {
    clone.rotation.y = -Math.PI / 2;
  }
  clone.updateMatrixWorld(true);
  box.setFromObject(clone);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z, 1e-4);
  clone.scale.setScalar(1 / maxDim);
  clone.updateMatrixWorld(true);

  box.setFromObject(clone);
  const center = box.getCenter(new THREE.Vector3());
  clone.position.sub(center);
  return clone;
}

function PlacedLog({
  log,
  template,
}: {
  log: PlacedLogPayload;
  template: THREE.Object3D;
}) {
  const { halfLength, halfThickness } = log;
  const mesh = useMemo(() => template.clone(true), [template]);
  // Uniform scale from collider thickness; physics cuboid may be longer than the mesh.
  const scale = halfThickness * 2 * 5;

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
      <group scale={[scale, scale, scale]}>
        <primitive object={mesh} />
      </group>
    </RigidBody>
  );
}

function LogsContent() {
  const { scene } = useGLTF(LOG_URL) as unknown as { scene: THREE.Object3D };
  const template = useMemo(() => buildLogTemplate(scene), [scene]);
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
        <PlacedLog key={`log-${log.id}`} log={log} template={template} />
      ))}
    </group>
  );
}

export default function Logs() {
  return (
    <Suspense fallback={null}>
      <LogsContent />
    </Suspense>
  );
}
