declare module "@dgreenheck/ez-tree" {
  import type * as THREE from "three";

  export class Tree extends THREE.Group {
    options: {
      copy(source: unknown): void;
      seed: number;
      branch: { levels: number; [k: string]: unknown };
      leaves: { count: number; [k: string]: unknown };
      [k: string]: unknown;
    };
    loadPreset(name: string): void;
    generate(): void;
    update(elapsedTime: number): void;
  }

  export const TreePreset: Record<string, unknown>;
}
