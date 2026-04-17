import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  AdaptiveDpr,
  AdaptiveEvents,
  KeyboardControls,
  PointerLockControls,
  Stats,
} from "@react-three/drei";
import { Physics } from "@react-three/rapier";

import Sky from "./world/Sky";
import Ground from "./world/Ground";
import Trees from "./world/Trees";
import Rocks from "./world/Rocks";
import Snakes from "./world/Snakes";
import Fish from "./world/Fish";
import Butterfly from "./world/Butterfly";
import Flowers from "./world/Flowers";
import Lake from "./world/Lake";
import Clouds from "./world/Clouds";
import Precipitation from "./world/Precipitation";
import Lightning from "./world/Lightning";
import Tornado from "./world/Tornado";
import Player from "./player/Player";
import HUD from "./ui/HUD";
import DevPanel from "./ui/DevPanel";
import { controlsMap } from "./player/usePlayerControls";

// Initialise systems that self-register via side effects.
import "./systems/world/groundState";

const debug = new URLSearchParams(window.location.search).has("debug");

export default function App() {
  return (
    <>
      <KeyboardControls map={controlsMap}>
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ fov: 75, near: 0.1, far: 500, position: [0, 8, 0] }}
        >
          <Suspense fallback={null}>
            <Sky />
            <Clouds />
            <Physics gravity={[0, -22, 0]} debug={debug}>
              <Ground />
              <Lake />
              <Trees />
              <Rocks />
              <Snakes />
              <Fish />
              <Butterfly />
              <Flowers />
              <Player />
              <Tornado />
            </Physics>
            <Precipitation />
            <Lightning />
          </Suspense>

          <PointerLockControls selector="body" />
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          {debug && <Stats />}
        </Canvas>
      </KeyboardControls>
      <HUD />
      <DevPanel />
    </>
  );
}
