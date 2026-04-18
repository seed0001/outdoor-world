import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";

const MAX_WAIT_MS = 14_000;

/**
 * Full-screen boot overlay until the first wave of assets finishes, or after a hard timeout.
 * Avoids an indefinite black screen when a huge asset stalls or errors (e.g. multi‑100MB FBX).
 * Follow-up loads after boot do not cover the screen again.
 */
export default function GameBootLoader() {
  const { active, progress } = useProgress();
  const sawWork = useRef(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (active) sawWork.current = true;
    if (sawWork.current && !active) setDismissed(true);
  }, [active]);

  useEffect(() => {
    const id = window.setTimeout(() => setDismissed(true), MAX_WAIT_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (dismissed) return null;

  const pct = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;

  return (
    <div className="game-boot-loader" aria-busy="true" aria-label="Loading world">
      <div className="game-boot-loader__panel">
        <p className="game-boot-loader__title">Loading world</p>
        <div className="game-boot-loader__track">
          <div
            className="game-boot-loader__bar"
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </div>
        <p className="game-boot-loader__pct mono">{pct.toFixed(0)}%</p>
      </div>
    </div>
  );
}
