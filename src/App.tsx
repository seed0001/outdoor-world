import { useState } from "react";
import DeviceSplash from "./ui/DeviceSplash";
import PlayModeSplash from "./ui/PlayModeSplash";
import GameRoot from "./GameRoot";
import type { DeviceMode } from "./deviceMode";
import type { PlayMode } from "./systems/settings/playMode";

export default function App() {
  const [deviceMode, setDeviceMode] = useState<DeviceMode | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode | null>(null);

  if (deviceMode == null) {
    return <DeviceSplash onSelect={setDeviceMode} />;
  }

  if (playMode == null) {
    return (
      <PlayModeSplash
        onSelect={setPlayMode}
        onBack={() => setDeviceMode(null)}
      />
    );
  }

  return (
    <GameRoot
      deviceMode={deviceMode}
      playMode={playMode}
      onExit={() => {
        setDeviceMode(null);
        setPlayMode(null);
      }}
    />
  );
}
