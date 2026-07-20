import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import {
  listChips,
  listGashes,
  pruneGashesForRemovedTargets,
  subscribeChopVfx,
  tickChopChips,
  type StrikeMaterial,
} from "../systems/world/chopVfx";
import { rocks as rockList } from "../systems/world/rockRegistry";
import { worldState } from "../systems/world/worldState";

function GashMark({
  position,
  quaternion,
  width,
  height,
  depth,
  material,
}: {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  width: number;
  height: number;
  depth: number;
  material: StrikeMaterial;
}) {
  return (
    <mesh
      position={position}
      quaternion={quaternion}
      renderOrder={2}
      castShadow={false}
      receiveShadow
    >
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color={material === "stone" ? "#2e2c28" : "#1a0f08"}
        roughness={1}
        metalness={material === "stone" ? 0.08 : 0}
        polygonOffset
        polygonOffsetFactor={-3}
        polygonOffsetUnits={-3}
      />
    </mesh>
  );
}

function ChipBurst({
  material,
  geometry,
  color,
}: {
  material: StrikeMaterial;
  geometry: THREE.BufferGeometry;
  color: string;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let idx = 0;
    for (const c of listChips()) {
      if (!c.active || c.material !== material) continue;
      dummy.position.copy(c.position);
      dummy.rotation.copy(c.rotation);
      const fade = Math.min(1, c.life / (c.maxLife * 0.35));
      dummy.scale.setScalar(c.scale * fade);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      idx++;
    }
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, 96]} frustumCulled={false}>
      <meshStandardMaterial color={color} roughness={material === "stone" ? 0.98 : 0.92} />
    </instancedMesh>
  );
}

function activeRockIds(): Set<number> {
  const ids = new Set<number>();
  for (const r of rockList) {
    if (!worldState.isRockDisplaced(r.id) && !worldState.isRockMined(r.id)) {
      ids.add(r.id);
    }
  }
  for (const d of worldState.listDisplacedRocks()) ids.add(d.id);
  return ids;
}

export default function ChopVfx() {
  const [, setGashRevision] = useState(0);
  const woodGeom = useMemo(() => new THREE.BoxGeometry(1, 0.55, 0.35), []);
  const stoneGeom = useMemo(() => new THREE.TetrahedronGeometry(0.5, 0), []);

  useFrame((_, dt) => {
    tickChopChips(dt);
  });

  useEffect(() => {
    const syncGashes = () => setGashRevision((r) => r + 1);
    const unsubVfx = subscribeChopVfx(syncGashes);
    const unsubWorld = worldState.subscribe(() => {
      const fallen = new Set(worldState.listFallenTrees().map((t) => t.id));
      const harvested = new Set(worldState.listTreesHarvestedToLog());
      const logs = new Set(worldState.listPlacedLogs().map((l) => l.id));
      pruneGashesForRemovedTargets(fallen, harvested, logs, activeRockIds());
    });
    return () => {
      unsubVfx();
      unsubWorld();
      woodGeom.dispose();
      stoneGeom.dispose();
    };
  }, [stoneGeom, woodGeom]);

  const gashes = listGashes();

  return (
    <group>
      {gashes.map((g) => (
        <GashMark
          key={g.id}
          position={g.position}
          quaternion={g.quaternion}
          width={g.width}
          height={g.height}
          depth={g.depth}
          material={g.material}
        />
      ))}
      <ChipBurst material="wood" geometry={woodGeom} color="#7a5a32" />
      <ChipBurst material="stone" geometry={stoneGeom} color="#8a8274" />
    </group>
  );
}
