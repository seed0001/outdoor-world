import { heightAt, mulberry32 } from "../../world/terrain";
import { SNAKE_DEN_X, SNAKE_DEN_Z } from "./snakeDen";

export interface SnakeSpec {
  id: number;
  /** Burrow spot under the rock pile (slight offset per snake). */
  denX: number;
  denZ: number;
  denY: number;
  /** How far this individual wanders from the den (metres). */
  patrolRadius: number;
  scale: number;
  animPhase: number;
  animSpeed: number;
  /** Desynchronises emerge / patrol timers between snakes. */
  timerOffset: number;
}

const SNAKE_COUNT = 5;
const SNAKE_SEED = 4207;

function generate(): SnakeSpec[] {
  const rand = mulberry32(SNAKE_SEED);
  const out: SnakeSpec[] = [];

  for (let i = 0; i < SNAKE_COUNT; i++) {
    const ang = rand() * Math.PI * 2;
    const r = rand() * 0.75;
    const x = SNAKE_DEN_X + Math.cos(ang) * r;
    const z = SNAKE_DEN_Z + Math.sin(ang) * r;

    out.push({
      id: i,
      denX: x,
      denZ: z,
      denY: heightAt(x, z),
      patrolRadius: 6 + rand() * 5,
      scale: 0.9 + rand() * 0.4,
      animPhase: rand(),
      animSpeed: 0.7 + rand() * 0.5,
      timerOffset: rand() * 40,
    });
  }
  return out;
}

export const snakes: ReadonlyArray<SnakeSpec> = generate();
