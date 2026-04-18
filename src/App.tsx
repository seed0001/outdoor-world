import { useState } from "react";
import DeviceSplash from "./ui/DeviceSplash";
import GameRoot from "./GameRoot";
import type { DeviceMode } from "./deviceMode";

export default function App() {
  const [deviceMode, setDeviceMode] = useState<DeviceMode | null>(null);

  if (deviceMode == null) {
    return <DeviceSplash onSelect={setDeviceMode} />;
  }

  return (
    <GameRoot deviceMode={deviceMode} onExit={() => setDeviceMode(null)} />
  );
}
