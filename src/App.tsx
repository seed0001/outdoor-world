import { useState } from "react";
import TitleScreen from "./ui/TitleScreen";
import DeviceSplash from "./ui/DeviceSplash";
import PlayModeSplash from "./ui/PlayModeSplash";
import GameRoot from "./GameRoot";
import type { DeviceMode } from "./deviceMode";
import type { PlayMode } from "./systems/settings/playMode";
import {
  loadSave,
  clearSave,
  queueSaveLoad,
} from "./systems/player/saveSystem";

type AppScreen = "title" | "device" | "playmode" | "game";

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("title");
  const [deviceMode, setDeviceMode] = useState<DeviceMode | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode | null>(null);
  const [runKey, setRunKey] = useState(0);

  const handleContinue = () => {
    const save = loadSave();
    if (!save) return;
    queueSaveLoad(save);
    setDeviceMode(save.deviceMode);
    setPlayMode(save.playMode);
    setScreen("game");
  };

  const handleNewGame = () => {
    clearSave();
    setScreen("device");
  };

  const handleRestart = () => {
    clearSave();
    setRunKey((k) => k + 1);
  };

  const handleExit = () => {
    setScreen("title");
    setDeviceMode(null);
    setPlayMode(null);
  };

  if (screen === "title") {
    return <TitleScreen onNewGame={handleNewGame} onContinue={handleContinue} />;
  }

  if (screen === "device") {
    return (
      <DeviceSplash
        onSelect={(dm) => {
          setDeviceMode(dm);
          setScreen("playmode");
        }}
      />
    );
  }

  if (screen === "playmode") {
    return (
      <PlayModeSplash
        onSelect={(pm) => {
          setPlayMode(pm);
          setScreen("game");
        }}
        onBack={() => setScreen("device")}
      />
    );
  }

  return (
    <GameRoot
      key={runKey}
      deviceMode={deviceMode!}
      playMode={playMode!}
      onExit={handleExit}
      onRestart={handleRestart}
    />
  );
}
