import { useKeyboardControls } from "@react-three/drei";

export type ControlName =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "jump"
  | "run";

export const controlsMap: { name: ControlName; keys: string[] }[] = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "back", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "jump", keys: ["Space"] },
  { name: "run", keys: ["ShiftLeft", "ShiftRight"] },
];

/**
 * Returns a getter that, when called, reads the current pressed state of
 * each named control. Using the getter form (not the subscriber form) is
 * intentional: we only read inside useFrame, so we never need React to
 * re-render on key changes.
 */
export function usePlayerControlsGetter() {
  const [, get] = useKeyboardControls<ControlName>();
  return get;
}
