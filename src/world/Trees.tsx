import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { createFoliageMaterial } from "./shaders/foliageMaterial";
import { snapshot } from "../systems/world/worldClock";
import { yearPhase } from "../systems/world/calendar";
import { getWeather } from "../systems/weather/weatherSystem";
import { worldState, type FallenTreePayload } from "../systems/world/worldState";
import { trees as treeList, type TreeSpec } from "../systems/world/treeRegistry";

const HIDDEN_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

function writeTrunkMatrix(t: TreeSpec, into: THREE.Object3D) {
  into.position.set(t.x, t.y + t.trunkHeight / 2, t.z);
  into.rotation.set(0, t.rot, 0);
  into.scale.set(t.scale, t.trunkHeight, t.scale);
  into.updateMatrix();
}

function writeFoliageMatrix(t: TreeSpec, into: THREE.Object3D) {
  into.position.set(
    t.x,
    t.y + t.trunkHeight + t.foliageHeight / 2,
    t.z,
  );
  into.rotation.set(0, t.rot, 0);
  into.scale.set(t.foliageRadius, t.foliageHeight, t.foliageRadius);
  into.updateMatrix();
}

export default function Trees() {
  const trunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const foliageMeshRef = useRef<THREE.InstancedMesh>(null);

  const trunkGeom = useMemo(
    () => new THREE.CylinderGeometry(0.18, 0.28, 1, 8),
    [],
  );
  const trunkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#4a2b14",
        roughness: 0.95,
      }),
    [],
  );

  const foliageGeom = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1, 8);
    const phaseArr = new Float32Array(treeList.length);
    for (let i = 0; i < treeList.length; i++) phaseArr[i] = treeList[i].phase;
    g.setAttribute(
      "aPhase",
      new THREE.InstancedBufferAttribute(phaseArr, 1),
    );
    return g;
  }, []);

  const { material: foliageMat, uniforms } = useMemo(
    () => createFoliageMaterial(),
    [],
  );

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

  // Rebuild instance matrices when tree set changes.
  useEffect(() => {
    const trunks = trunkMeshRef.current;
    const foliage = foliageMeshRef.current;
    if (!trunks || !foliage) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < treeList.length; i++) {
      const t = treeList[i];
      if (standingHiddenIds.has(treeList[i].id)) {
        trunks.setMatrixAt(i, HIDDEN_MATRIX);
        foliage.setMatrixAt(i, HIDDEN_MATRIX);
      } else {
        writeTrunkMatrix(t, dummy);
        trunks.setMatrixAt(i, dummy.matrix);
        writeFoliageMatrix(t, dummy);
        foliage.setMatrixAt(i, dummy.matrix);
      }
    }
    trunks.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    trunks.computeBoundingSphere();
    foliage.computeBoundingSphere();
  }, [standingHiddenIds]);

  useEffect(
    () => () => {
      trunkGeom.dispose();
      foliageGeom.dispose();
      trunkMat.dispose();
      foliageMat.dispose();
    },
    [trunkGeom, foliageGeom, trunkMat, foliageMat],
  );

  useFrame((_, dt) => {
    const { yearFrac } = snapshot();
    const weather = getWeather();
    uniforms.uYearPhase.value = yearPhase(yearFrac);
    uniforms.uTime.value += dt;
    const target = weather.windStrength;
    uniforms.uWind.value +=
      (target - uniforms.uWind.value) * Math.min(1, dt * 2);
  });

  return (
    <group>
      <instancedMesh
        ref={trunkMeshRef}
        args={[trunkGeom, trunkMat, treeList.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={foliageMeshRef}
        args={[foliageGeom, foliageMat, treeList.length]}
        castShadow
        receiveShadow
      />

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
            args={[payload.trunkRadius * 0.7, payload.trunkRadius, payload.trunkHeight, 8]}
          />
          <meshStandardMaterial color="#4a2b14" roughness={0.95} />
        </mesh>
        <mesh
          castShadow
          receiveShadow
          position={[0, payload.trunkHeight / 2, 0]}
        >
          <coneGeometry args={[payload.foliageRadius, payload.foliageHeight, 8]} />
          <meshStandardMaterial color="#4a5d2b" roughness={1} />
        </mesh>
      </group>
    </RigidBody>
  );
}
