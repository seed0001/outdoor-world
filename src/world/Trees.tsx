import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { createFoliageMaterial } from "./shaders/foliageMaterial";
import { snapshot } from "../systems/world/worldClock";
import { yearPhase } from "../systems/world/calendar";
import { getWeather } from "../systems/weather/weatherSystem";
import { worldState, type FallenTreePayload } from "../systems/world/worldState";
import {
  trees as treeList,
  type TreeKind,
  type TreeSpec,
} from "../systems/world/treeRegistry";

const HIDDEN_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

const TRUNK_COLORS = ["#4a2b14", "#2d1a0c", "#c8b8a8", "#3d2818"] as const;

/** One instanced batch per kind — built once from the static registry. */
const treeBuckets: TreeSpec[][] = [[], [], [], []];
for (const t of treeList) {
  treeBuckets[t.kind].push(t);
}

const treeIdToSlot = new Map<
  number,
  { kind: TreeKind; index: number }
>();
for (let k = 0; k < 4; k++) {
  const kind = k as TreeKind;
  treeBuckets[kind].forEach((t, i) => {
    treeIdToSlot.set(t.id, { kind, index: i });
  });
}

function makeFoliageGeometry(kind: TreeKind, bucket: TreeSpec[]): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  if (kind === 3) {
    g = new THREE.IcosahedronGeometry(1, 1);
  } else if (kind === 1) {
    g = new THREE.ConeGeometry(1, 1, 10);
  } else {
    g = new THREE.ConeGeometry(1, 1, 8);
  }
  const phaseArr = new Float32Array(bucket.length);
  for (let i = 0; i < bucket.length; i++) phaseArr[i] = bucket[i].phase;
  g.setAttribute(
    "aPhase",
    new THREE.InstancedBufferAttribute(phaseArr, 1),
  );
  return g;
}

const TRUNK_GEOM: THREE.BufferGeometry[] = [
  new THREE.CylinderGeometry(0.18, 0.28, 1, 8),
  new THREE.CylinderGeometry(0.12, 0.17, 1, 8),
  new THREE.CylinderGeometry(0.09, 0.13, 1, 8),
  new THREE.CylinderGeometry(0.16, 0.24, 1, 8),
];

const FOLIAGE_GEOM: THREE.BufferGeometry[] = [
  makeFoliageGeometry(0, treeBuckets[0]),
  makeFoliageGeometry(1, treeBuckets[1]),
  makeFoliageGeometry(2, treeBuckets[2]),
  makeFoliageGeometry(3, treeBuckets[3]),
];

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
  const trunkRef0 = useRef<THREE.InstancedMesh>(null);
  const trunkRef1 = useRef<THREE.InstancedMesh>(null);
  const trunkRef2 = useRef<THREE.InstancedMesh>(null);
  const trunkRef3 = useRef<THREE.InstancedMesh>(null);
  const foliageRef0 = useRef<THREE.InstancedMesh>(null);
  const foliageRef1 = useRef<THREE.InstancedMesh>(null);
  const foliageRef2 = useRef<THREE.InstancedMesh>(null);
  const foliageRef3 = useRef<THREE.InstancedMesh>(null);

  const trunkRefs = [trunkRef0, trunkRef1, trunkRef2, trunkRef3];
  const foliageRefs = [foliageRef0, foliageRef1, foliageRef2, foliageRef3];

  const trunkMats = useMemo(
    () =>
      TRUNK_COLORS.map(
        (c) =>
          new THREE.MeshStandardMaterial({
            color: c,
            roughness: 0.95,
          }),
      ),
    [],
  );

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

  useEffect(() => {
    const dummy = new THREE.Object3D();
    for (const t of treeList) {
      const slot = treeIdToSlot.get(t.id);
      if (!slot) continue;
      const tr = trunkRefs[slot.kind].current;
      const fo = foliageRefs[slot.kind].current;
      if (!tr || !fo) continue;
      if (standingHiddenIds.has(t.id)) {
        tr.setMatrixAt(slot.index, HIDDEN_MATRIX);
        fo.setMatrixAt(slot.index, HIDDEN_MATRIX);
      } else {
        writeTrunkMatrix(t, dummy);
        tr.setMatrixAt(slot.index, dummy.matrix);
        writeFoliageMatrix(t, dummy);
        fo.setMatrixAt(slot.index, dummy.matrix);
      }
    }
    for (let k = 0; k < 4; k++) {
      const tr = trunkRefs[k].current;
      const fo = foliageRefs[k].current;
      if (tr) {
        tr.instanceMatrix.needsUpdate = true;
        tr.computeBoundingSphere();
      }
      if (fo) {
        fo.instanceMatrix.needsUpdate = true;
        fo.computeBoundingSphere();
      }
    }
  }, [standingHiddenIds]);

  useEffect(
    () => () => {
      TRUNK_GEOM.forEach((g) => g.dispose());
      FOLIAGE_GEOM.forEach((g) => g.dispose());
      trunkMats.forEach((m) => m.dispose());
      foliageMat.dispose();
    },
    [trunkMats, foliageMat],
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
      {[0, 1, 2, 3].map((k) => {
        const n = treeBuckets[k].length;
        if (n === 0) return null;
        return (
          <group key={k}>
            <instancedMesh
              ref={trunkRefs[k]}
              args={[TRUNK_GEOM[k], trunkMats[k], n]}
              castShadow
              receiveShadow
            />
            <instancedMesh
              ref={foliageRefs[k]}
              args={[FOLIAGE_GEOM[k], foliageMat, n]}
              castShadow
              receiveShadow
            />
          </group>
        );
      })}

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
