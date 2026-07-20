import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { scatterRocks } from "../systems/world/rockRegistry";
import { worldState } from "../systems/world/worldState";

/** Lens-shaped slash: pointed ends along local X, shallow depth along Z. */
function buildGashGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const L = 1;
  const W = 0.34;
  shape.moveTo(-L, 0);
  shape.quadraticCurveTo(-L * 0.28, W, 0, W * 0.92);
  shape.quadraticCurveTo(L * 0.28, W, L, 0);
  shape.quadraticCurveTo(L * 0.28, -W, 0, -W * 0.92);
  shape.quadraticCurveTo(-L * 0.28, -W, -L, 0);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: false,
    curveSegments: 10,
    steps: 1,
  });
  geom.translate(0, 0, -0.07);
  return geom;
}

function GashMark({
  geometry,
  position,
  quaternion,
  width,
  height,
  depth,
  material,
}: {
  geometry: THREE.ExtrudeGeometry;
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
      scale={[width * 0.5, height, depth / 0.14]}
      renderOrder={2}
      castShadow={false}
      receiveShadow
    >
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        color={material === "stone" ? "#b5aea4" : "#c4a574"}
        roughness={0.96}
        metalness={0}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

function ChipBurst({
  material,
  geometry,
  color,
}: {
  material: "wood" | "stone";
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

function FlowerChipBurst({ geometry }: { geometry: THREE.BufferGeometry }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(96 * 3),
      3,
    );
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let idx = 0;
    for (const c of listChips()) {
      if (!c.active || c.material !== "flower") continue;
      dummy.position.copy(c.position);
      dummy.rotation.copy(c.rotation);
      const fade = Math.min(1, c.life / (c.maxLife * 0.35));
      dummy.scale.setScalar(c.scale * fade);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      colorScratch.set(c.chipColor);
      mesh.setColorAt(idx, colorScratch);
      idx++;
    }
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, 96]}
      frustumCulled={false}
    >
      <meshBasicMaterial
        vertexColors
        toneMapped={false}
        side={THREE.DoubleSide}
        depthWrite={false}
        transparent
      />
    </instancedMesh>
  );
}

function activeRockIds(): Set<number> {
  const ids = new Set<number>();
  for (const r of scatterRocks) {
    if (!worldState.isRockDisplaced(r.id) && !worldState.isRockMined(r.id)) {
      ids.add(r.id);
    }
  }
  for (const d of worldState.listDisplacedRocks()) ids.add(d.id);
  return ids;
}

export default function ChopVfx() {
  const [, setGashRevision] = useState(0);
  const gashGeom = useMemo(() => buildGashGeometry(), []);
  const woodGeom = useMemo(() => new THREE.BoxGeometry(1, 0.55, 0.35), []);
  const stoneGeom = useMemo(() => new THREE.TetrahedronGeometry(0.5, 0), []);
  const flowerGeom = useMemo(() => new THREE.PlaneGeometry(0.28, 0.28), []);

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
      gashGeom.dispose();
      woodGeom.dispose();
      stoneGeom.dispose();
      flowerGeom.dispose();
    };
  }, [gashGeom, flowerGeom, stoneGeom, woodGeom]);

  const gashes = listGashes();

  return (
    <group>
      {gashes.map((g) => (
        <GashMark
          key={g.id}
          geometry={gashGeom}
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
      <FlowerChipBurst geometry={flowerGeom} />
    </group>
  );
}
