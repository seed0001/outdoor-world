import { CuboidCollider, RigidBody } from "@react-three/rapier";
import {
  HALF_X,
  WORLD_MIN_Z,
  WORLD_MAX_Z,
  WORLD_CENTER_Z,
} from "./terrain";

/**
 * Vertical slabs just past the terrain rim so the player cannot walk off the
 * heightfield. Slightly wider than the playable X/Z so corners overlap cleanly.
 */
const WALL_THICK = 0.55;
const HALF_THICK = WALL_THICK / 2;
/** Half-extents Y: wall from ~y=-12 to ~y=24 (covers jump + terrain dip). */
const WALL_HALF_Y = 18;
const WALL_CENTER_Y = 6;

const SPAN_X = HALF_X + HALF_THICK;
/** Half-extent along Z for east/west walls (world is longer south–north). */
const SPAN_Z =
  (WORLD_MAX_Z - WORLD_MIN_Z) / 2 + HALF_THICK;

export default function WorldBounds() {
  return (
    <>
      <RigidBody type="fixed" colliders={false} name="bounds_north">
        <CuboidCollider
          args={[SPAN_X, WALL_HALF_Y, HALF_THICK]}
          position={[0, WALL_CENTER_Y, WORLD_MAX_Z + HALF_THICK]}
        />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="bounds_south">
        <CuboidCollider
          args={[SPAN_X, WALL_HALF_Y, HALF_THICK]}
          position={[0, WALL_CENTER_Y, WORLD_MIN_Z - HALF_THICK]}
        />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="bounds_east">
        <CuboidCollider
          args={[HALF_THICK, WALL_HALF_Y, SPAN_Z]}
          position={[HALF_X + HALF_THICK, WALL_CENTER_Y, WORLD_CENTER_Z]}
        />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="bounds_west">
        <CuboidCollider
          args={[HALF_THICK, WALL_HALF_Y, SPAN_Z]}
          position={[-HALF_X - HALF_THICK, WALL_CENTER_Y, WORLD_CENTER_Z]}
        />
      </RigidBody>
    </>
  );
}
