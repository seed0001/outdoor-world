import { useEffect, useRef } from "react";
import { playerRef } from "../systems/player/playerRef";

/**
 * World +Z is north; the fixed marker at the top is “forward”. The rose
 * rotates with the camera yaw so cardinal directions stay aligned.
 */
export default function Compass() {
  const roseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      const el = roseRef.current;
      if (el) {
        const deg = (-playerRef.heading * 180) / Math.PI;
        el.style.transform = `rotate(${deg}deg)`;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="compass" role="status" aria-label="Compass, north toward world positive Z">
      <div className="compass-bezel">
        <div className="compass-rose" ref={roseRef}>
          <span className="compass-n">N</span>
          <span className="compass-e">E</span>
          <span className="compass-s">S</span>
          <span className="compass-w">W</span>
        </div>
        <div className="compass-marker" aria-hidden />
      </div>
    </div>
  );
}
