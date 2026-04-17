import { useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  worldState,
  type StonePickupPayload,
} from "../systems/world/worldState";
import { playerRef } from "../systems/player/playerRef";
import { inventory } from "../systems/player/inventory";

const PICKUP_R2 = 1.45 * 1.45;

export default function StonePickups() {
  const [pickups, setPickups] = useState<StonePickupPayload[]>(() =>
    worldState.listStonePickups(),
  );

  useEffect(() => {
    const sync = () => setPickups(worldState.listStonePickups());
    sync();
    return worldState.subscribe(sync);
  }, []);

  useFrame(() => {
    const px = playerRef.position.x;
    const py = playerRef.position.y;
    const pz = playerRef.position.z;
    const collected: number[] = [];
    for (const p of worldState.listStonePickups()) {
      const dx = p.position[0] - px;
      const dy = p.position[1] - py;
      const dz = p.position[2] - pz;
      if (dx * dx + dy * dy + dz * dz <= PICKUP_R2) {
        inventory.add("stone", p.stones);
        collected.push(p.id);
      }
    }
    for (const id of collected) worldState.removeStonePickup(id);
  });

  return (
    <group>
      {pickups.map((p) => (
        <mesh
          key={`stone-${p.id}`}
          position={p.position}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[0.14, 0]} />
          <meshStandardMaterial color="#9a9488" roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}
