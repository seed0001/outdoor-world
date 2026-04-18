import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

const SENS = 0.0022;

/**
 * Drag-to-look for touch / mouse when pointer lock is not used (tablet & phone).
 */
export default function TouchLookControls({ enabled }: { enabled: boolean }) {
  const { camera, gl } = useThree();
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const active = useRef(false);
  const pointerId = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;

    const clampPitch = (x: number) =>
      THREE.MathUtils.clamp(x, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType !== "touch") return;
      active.current = true;
      pointerId.current = e.pointerId;
      last.current = { x: e.clientX, y: e.clientY };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onUp = (e: PointerEvent) => {
      if (pointerId.current !== null && e.pointerId === pointerId.current) {
        active.current = false;
        pointerId.current = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!active.current) return;
      if (e.pointerId !== pointerId.current && pointerId.current !== null) return;
      let dx = e.movementX;
      let dy = e.movementY;
      if (!dx && !dy && e.pointerType === "touch") {
        dx = e.clientX - last.current.x;
        dy = e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY };
      }
      euler.setFromQuaternion(camera.quaternion, "YXZ");
      euler.y -= dx * SENS;
      euler.x -= dy * SENS;
      euler.x = clampPitch(euler.x);
      camera.quaternion.setFromEuler(euler);
      last.current = { x: e.clientX, y: e.clientY };
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointermove", onMove);
    };
  }, [enabled, camera, gl, euler]);

  return null;
}
