import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { HALF } from "./terrain";

/**
 * Vertical slabs just past the terrain rim so the player cannot walk off the
 * heightfield. Slightly wider than HALF so corners overlap cleanly.
 */
const WALL_THICK = 0.55;
const HALF_THICK = WALL_THICK / 2;
/** Half-extents Y: wall from ~y=-12 to ~y=24 (covers jump + terrain dip). */
const WALL_HALF_Y = 18;
const WALL_CENTER_Y = 6;

const SPAN = HALF + HALF_THICK;

export default function WorldBounds() {
  return (
    <>
      <RigidBody type="fixed" colliders={false} name="bounds_north">
        <CuboidCollider
          args={[SPAN, WALL_HALF_Y, HALF_THICK]}
          position={[0, WALL_CENTER_Y, HALF + HALF_THICK]}
        />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="bounds_south">
        <CuboidCollider
          args={[SPAN, WALL_HALF_Y, HALF_THICK]}
          position={[0, WALL_CENTER_Y, -HALF - HALF_THICK]}
        />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="bounds_east">
        <CuboidCollider
          args={[HALF_THICK, WALL_HALF_Y, SPAN]}
          position={[HALF + HALF_THICK, WALL_CENTER_Y, 0]}
        />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="bounds_west">
        <CuboidCollider
          args={[HALF_THICK, WALL_HALF_Y, SPAN]}
          position={[-HALF - HALF_THICK, WALL_CENTER_Y, 0]}
        />
      </RigidBody>
    </>
  );
}
