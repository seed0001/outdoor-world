import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  AdaptiveDpr,
  AdaptiveEvents,
  KeyboardControls,
  PointerLockControls,
  Stats,
} from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { XR, useXR } from "@react-three/xr";

import Sky from "./world/Sky";
import Ground from "./world/Ground";
import Trees from "./world/Trees";
import DesertTrees from "./world/DesertTrees";
import Rocks from "./world/Rocks";
import SnakeDen from "./world/SnakeDen";
import Snakes from "./world/Snakes";
import Rats from "./world/Rats";
import Fish from "./world/Fish";
import Butterfly from "./world/Butterfly";
import Birds from "./world/Birds";
import Bees from "./world/Bees";
import Flowers from "./world/Flowers";
import ColoredFlowerPatches from "./world/ColoredFlowerPatches";
import RoseFlowers from "./world/RoseFlowers";
import Lake from "./world/Lake";
import Clouds from "./world/Clouds";
import Precipitation from "./world/Precipitation";
import Lightning from "./world/Lightning";
import Tornado from "./world/Tornado";
import Player from "./player/Player";
import HeldAxe from "./player/HeldAxe";
import ChopSystem from "./player/ChopSystem";
import ActionFSystem from "./player/ActionFSystem";
import TreeInspectRay from "./player/TreeInspectRay";
import HeadingSync from "./player/HeadingSync";
import VitalsSystem from "./player/VitalsSystem";
import Logs from "./world/Logs";
import StonePickups from "./world/StonePickups";
import Arrows from "./world/Arrows";
import WorldBounds from "./world/WorldBounds";
import Campfires from "./world/Campfires";
import SturdyFrames from "./world/SturdyFrames";
import SturdyPlacementPreview from "./world/SturdyPlacementPreview";
import HUD from "./ui/HUD";
import TreeInspectPopup from "./ui/TreeInspectPopup";
import DevPanel from "./ui/DevPanel";
import EcosystemPanel from "./ui/EcosystemPanel";
import TouchLookControls from "./player/TouchLookControls";
import ARSessionPanel from "./ui/ARSessionPanel";
import type { DeviceMode } from "./deviceMode";
import { controlsMap } from "./player/usePlayerControls";
import { xrStore } from "./xrStore";
import { sturdyFrames } from "./systems/world/sturdyFrames";
import GameBootLoader from "./ui/GameBootLoader";
import ViewRecorder from "./ui/ViewRecorder";
import {
  configurePlayMode,
  resetPlayMode,
  type PlayMode,
} from "./systems/settings/playMode";

import "./systems/world/groundState";
import "./systems/world/birdState";
import "./systems/player/survival";
import { unlockGameAudio } from "./systems/audio/gameAudio";

const debug = new URLSearchParams(window.location.search).has("debug");

function DesktopPointerLock({ deviceMode }: { deviceMode: DeviceMode }) {
  const session = useXR((s) => s.session);
  if (deviceMode !== "desktop" || session != null) return null;
  return <PointerLockControls selector="body" />;
}

function TouchLookForTouchDevices({ deviceMode }: { deviceMode: DeviceMode }) {
  const session = useXR((s) => s.session);
  const enabled =
    (deviceMode === "tablet" || deviceMode === "phone") && session == null;
  return <TouchLookControls enabled={enabled} />;
}

export default function GameRoot({
  deviceMode,
  playMode,
  onExit,
}: {
  deviceMode: DeviceMode;
  playMode: PlayMode;
  onExit: () => void;
}) {
  configurePlayMode(playMode);

  useEffect(() => () => resetPlayMode(), []);

  const canvasWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const up = () => unlockGameAudio();
    window.addEventListener("pointerdown", up, { capture: true, once: true });
    return () =>
      window.removeEventListener("pointerdown", up, { capture: true });
  }, []);

  const [hasShelterInWorld, setHasShelterInWorld] = useState(
    () => sturdyFrames.list().length > 0,
  );
  useEffect(
    () =>
      sturdyFrames.subscribe(() => {
        setHasShelterInWorld(sturdyFrames.list().length > 0);
      }),
    [],
  );

  const shellClass =
    deviceMode === "tablet"
      ? "device-shell device-shell--tablet"
      : deviceMode === "phone"
        ? "device-shell device-shell--phone"
        : "device-shell device-shell--desktop";

  return (
    <div className={shellClass}>
      <button
        type="button"
        className="device-back"
        onClick={onExit}
        title="Back to device selection"
      >
        ← Devices
      </button>

      <KeyboardControls map={controlsMap}>
        <div className="device-shell__canvas-wrap" ref={canvasWrapRef}>
          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            camera={{ fov: 75, near: 0.1, far: 500, position: [0, 8, 0] }}
          >
            <XR store={xrStore}>
              <Suspense fallback={null}>
                <Sky />
                <Clouds />
              </Suspense>
              <Suspense fallback={null}>
                <Butterfly />
              </Suspense>
              <Birds />
              <Suspense fallback={null}>
                <Bees />
              </Suspense>
              <Physics gravity={[0, -22, 0]} debug={debug}>
                <WorldBounds />
                <Ground />
                <SturdyPlacementPreview />
                <Lake />
                <SnakeDen />
                <Trees />
                <Suspense fallback={null}>
                  <DesertTrees />
                </Suspense>
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
                <Suspense fallback={null}>
                  <ColoredFlowerPatches />
                </Suspense>
                <Suspense fallback={null}>
                  <RoseFlowers />
                </Suspense>
                <StonePickups />
                <Suspense fallback={null}>
                  <Arrows />
                </Suspense>
                {hasShelterInWorld && (
                  <Suspense fallback={null}>
                    <SturdyFrames />
                  </Suspense>
                )}
                <Player />
                <HeldAxe />
                <ChopSystem />
                <TreeInspectRay />
                <HeadingSync />
                <VitalsSystem />
                <Tornado />
              </Physics>
              <Campfires />
              <Suspense fallback={null}>
                <Precipitation />
                <Lightning />
              </Suspense>

              <DesktopPointerLock deviceMode={deviceMode} />
              <TouchLookForTouchDevices deviceMode={deviceMode} />
              <AdaptiveDpr pixelated />
              <AdaptiveEvents />
              {debug && <Stats />}
            </XR>
          </Canvas>
        </div>
      </KeyboardControls>
      <GameBootLoader />
      <ActionFSystem />
      <HUD showSurvivalVitals={playMode === "survive"} />
      <ViewRecorder canvasWrapRef={canvasWrapRef} />
      <TreeInspectPopup />
      <DevPanel />
      <EcosystemPanel />
      <ARSessionPanel deviceMode={deviceMode} />
    </div>
  );
}
