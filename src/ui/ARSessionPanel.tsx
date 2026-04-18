import { useEffect, useState } from "react";
import type { DeviceMode } from "../deviceMode";
import { xrStore } from "../xrStore";

/**
 * Phone mode: offer immersive AR when the browser supports WebXR `immersive-ar`.
 */
export default function ARSessionPanel({
  deviceMode,
}: {
  deviceMode: DeviceMode;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (deviceMode !== "phone") {
      setSupported(null);
      return;
    }
    const xr = navigator.xr;
    if (xr == null) {
      setSupported(false);
      return;
    }
    let cancelled = false;
    xr.isSessionSupported("immersive-ar")
      .then((ok) => {
        if (!cancelled) setSupported(ok);
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceMode]);

  if (deviceMode !== "phone") return null;

  return (
    <div className="ar-session-panel">
      {supported === false && (
        <p className="ar-session-panel__note">
          AR isn’t available here (use HTTPS, a compatible browser, or a
          device with AR).
        </p>
      )}
      {supported === true && (
        <>
          <button
            type="button"
            className="ar-session-panel__enter"
            onClick={() => void xrStore.enterAR()}
          >
            Enter AR
          </button>
          <p className="ar-session-panel__hint">
            Places the scene in passthrough AR when your device supports it.
          </p>
        </>
      )}
    </div>
  );
}
