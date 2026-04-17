import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import {
  AdaptiveDpr,
  AdaptiveEvents,
  KeyboardControls,
  Loader,
  PointerLockControls,
  Stats,
} from "@react-three/drei";
import { Physics } from "@react-three/rapier";

import Sky from "./world/Sky";
import Ground from "./world/Ground";
import Trees from "./world/Trees";
import Rocks from "./world/Rocks";
import SnakeDen from "./world/SnakeDen";
import Snakes from "./world/Snakes";
import Rats from "./world/Rats";
import Fish from "./world/Fish";
import Butterfly from "./world/Butterfly";
import Flowers from "./world/Flowers";
import Lake from "./world/Lake";
import Clouds from "./world/Clouds";
import Precipitation from "./world/Precipitation";
import Lightning from "./world/Lightning";
import Tornado from "./world/Tornado";
import Player from "./player/Player";
import HeldAxe from "./player/HeldAxe";
import ChopSystem from "./player/ChopSystem";
import TreeInspectRay from "./player/TreeInspectRay";
import HeadingSync from "./player/HeadingSync";
import Logs from "./world/Logs";
import StonePickups from "./world/StonePickups";
import WorldBounds from "./world/WorldBounds";
import HUD from "./ui/HUD";
import TreeInspectPopup from "./ui/TreeInspectPopup";
import DevPanel from "./ui/DevPanel";
import EcosystemPanel from "./ui/EcosystemPanel";
import { controlsMap } from "./player/usePlayerControls";

// Initialise systems that self-register via side effects.
import "./systems/world/groundState";
import { unlockGameAudio } from "./systems/audio/gameAudio";

const debug = new URLSearchParams(window.location.search).has("debug");

export default function App() {
  useEffect(() => {
    const up = () => unlockGameAudio();
    window.addEventListener("pointerdown", up, { capture: true, once: true });
    return () =>
      window.removeEventListener("pointerdown", up, { capture: true });
  }, []);

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
          </Suspense>
          <Suspense fallback={null}>
            <Butterfly />
          </Suspense>
          <Physics gravity={[0, -22, 0]} debug={debug}>
            <WorldBounds />
            <Ground />
            <Lake />
            <SnakeDen />
            <Trees />
            <Logs />
            <Rocks />
            <Suspense fallback={null}>
              <Snakes />
            </Suspense>
            <Suspense fallback={null}>
              <Rats />
            </Suspense>
            <Suspense fallback={null}>
              <Fish />
            </Suspense>
            <Suspense fallback={null}>
              <Flowers />
            </Suspense>
            <StonePickups />
            <Player />
            <HeldAxe />
            <ChopSystem />
            <TreeInspectRay />
            <HeadingSync />
            <Tornado />
          </Physics>
          <Suspense fallback={null}>
            <Precipitation />
            <Lightning />
          </Suspense>

          <PointerLockControls selector="body" />
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          {debug && <Stats />}
        </Canvas>
      </KeyboardControls>
      <Loader />
      <HUD />
      <TreeInspectPopup />
      <DevPanel />
      <EcosystemPanel />
    </>
  );
}
