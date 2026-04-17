import { useEffect, useState } from "react";
import { useWorldTime } from "../systems/world/worldClock";
import {
  monthName,
  seasonForMonth,
  seasonName,
  temperatureC,
} from "../systems/world/calendar";
import {
  getWeather,
  subscribeWeather,
  WEATHER_LABELS,
} from "../systems/weather/weatherSystem";
import { useHealth, health } from "../systems/player/health";
import { playerRef } from "../systems/player/playerRef";
import { fireCommand } from "../systems/world/commands";
import WeatherIcon from "./WeatherIcon";
import Compass from "./Compass";

function formatClock(dayFrac: number): string {
  const minutes = Math.floor(dayFrac * 24 * 60);
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export default function HUD() {
  const [locked, setLocked] = useState(false);
  const world = useWorldTime(4);
  const hp = useHealth();
  const [weatherTick, setWeatherTick] = useState(0);

  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  useEffect(() => {
    const unsub = subscribeWeather(() => setWeatherTick((n) => n + 1));
    return unsub;
  }, []);

  const weather = getWeather();
  void weatherTick;
  const season = seasonForMonth(world.monthIndex);
  const temp = temperatureC(world, playerRef.position.y, weather.tempMod);

  // Flash red when recently damaged
  const sinceHit = hp.lastDamageAtMs
    ? performance.now() - hp.lastDamageAtMs
    : Infinity;
  const hitFlash = sinceHit < 350 ? 1 - sinceHit / 350 : 0;

  return (
    <div className="hud">
      {locked && <div className="crosshair" aria-hidden />}

      <div
        className="damage-vignette"
        style={{ opacity: hitFlash * 0.8 }}
        aria-hidden
      />

      {locked && !hp.dead && <Compass />}

      {locked && !hp.dead && (
        <div className="world-readout">
          <div className="line">
            <span className="mono">{formatClock(world.dayFrac)}</span>
            <span>
              {monthName(world.monthIndex)} {Math.floor(world.monthProgress * 30) + 1}
            </span>
          </div>
          <div className="line muted">
            <span>{seasonName(season)}</span>
            <span>{temp.toFixed(0)} deg C</span>
          </div>
          <div className="line weather">
            <WeatherIcon type={weather.type} />
            <span>{WEATHER_LABELS[weather.type]}</span>
            {weather.windStrength > 0.8 && <span className="wind">wind</span>}
          </div>
        </div>
      )}

      {locked && !hp.dead && (
        <div className="health-bar">
          <div
            className="fill"
            style={{ width: `${(hp.hp / hp.max) * 100}%` }}
          />
          <span className="label">
            {hp.hp}/{hp.max}
          </span>
        </div>
      )}

      {hp.dead && (
        <div className="death-screen">
          <h1>You were killed</h1>
          <p>
            {hp.deathSource
              ? `by ${hp.deathSource}`
              : "somehow"}
          </p>
          <button
            type="button"
            onClick={() => {
              health.respawn();
              fireCommand("player:respawn");
            }}
          >
            Respawn
          </button>
        </div>
      )}

      <div
        className={`overlay ${locked || hp.dead ? "hidden" : ""}`}
        aria-hidden={locked || hp.dead}
      >
        <h1>Step into the world</h1>
        <p>Click anywhere to capture your mouse and start exploring.</p>

        <div className="controls">
          <span>
            <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>
          </span>
          <span>move</span>
          <span>
            <kbd>Shift</kbd>
          </span>
          <span>run</span>
          <span>
            <kbd>Space</kbd>
          </span>
          <span>jump</span>
          <span>
            <kbd>Mouse</kbd>
          </span>
          <span>look around</span>
          <span>
            <kbd>F1</kbd>
          </span>
          <span>dev panel</span>
          <span>
            <kbd>Esc</kbd>
          </span>
          <span>release mouse</span>
        </div>

        <div className="hint">Click to begin</div>
      </div>
    </div>
  );
}
