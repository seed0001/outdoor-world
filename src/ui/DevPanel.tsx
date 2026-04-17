import { useEffect, useState } from "react";
import {
  jumpToSeason,
  resetWorldClock,
  setPaused,
  setTimeScale,
  useWorldTime,
  type SeasonIndex,
} from "../systems/world/worldClock";
import {
  monthName,
  seasonName,
  seasonForMonth,
  temperatureC,
} from "../systems/world/calendar";
import {
  forceWeather,
  getWeather,
  releaseForcedWeather,
  subscribeWeather,
} from "../systems/weather/weatherSystem";
import {
  WEATHER_LABELS,
  type WeatherType,
} from "../systems/weather/types";
import { fireCommand } from "../systems/world/commands";
import { worldState } from "../systems/world/worldState";
import { health, useHealth } from "../systems/player/health";
import { inventory } from "../systems/player/inventory";
import { playerRef } from "../systems/player/playerRef";
import { releasePointerLockForUI } from "../systems/ui/pointerLock";

const SCALES: { label: string; value: number }[] = [
  { label: "Pause", value: 0 },
  { label: "1x (real)", value: 1 },
  { label: "60x (1s = 1min)", value: 60 },
  { label: "600x", value: 600 },
  { label: "3600x (1s = 1hr)", value: 3600 },
  { label: "86400x (1s = 1day)", value: 86400 },
];

const WEATHERS: WeatherType[] = [
  "clear",
  "cloudy",
  "rain",
  "hail",
  "thunderstorm",
  "snow",
  "blizzard",
  "tornado",
];

function formatClock(dayFrac: number): string {
  const minutes = Math.floor(dayFrac * 24 * 60);
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export default function DevPanel() {
  const [open, setOpen] = useState(false);
  const world = useWorldTime(8);
  const hp = useHealth();
  const [weatherTick, setWeatherTick] = useState(0);
  const [forced, setForcedLocal] = useState<WeatherType | "auto">("auto");

  useEffect(() => {
    const unsub = subscribeWeather(() => setWeatherTick((n) => n + 1));
    return unsub;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "F1" || e.key === "`") {
        e.preventDefault();
        setOpen((o) => {
          const next = !o;
          if (next) releasePointerLockForUI();
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) {
    return (
      <div className="devpanel-hint" aria-hidden>
        <kbd>F1</kbd> dev panel
      </div>
    );
  }

  const weather = getWeather();
  void weatherTick;
  const traditionalSeason = seasonForMonth(world.monthIndex);
  const temp = temperatureC(world, playerRef.position.y, weather.tempMod);

  return (
    <div className="devpanel" role="dialog">
      <header>
        <strong>Dev Panel</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="close">
          x
        </button>
      </header>

      <section>
        <div className="row">
          <span>Date</span>
          <span>
            {monthName(world.monthIndex)} {Math.floor(world.monthProgress * 30) + 1}
          </span>
        </div>
        <div className="row">
          <span>Time</span>
          <span>{formatClock(world.dayFrac)}</span>
        </div>
        <div className="row">
          <span>Season</span>
          <span>{seasonName(traditionalSeason)}</span>
        </div>
        <div className="row">
          <span>Temperature</span>
          <span>{temp.toFixed(1)} deg C</span>
        </div>
        <div className="row">
          <span>Weather</span>
          <span>
            {WEATHER_LABELS[weather.type]} ({Math.round(weather.intensity * 100)}%)
            {weather.target ? ` -> ${WEATHER_LABELS[weather.target]}` : ""}
          </span>
        </div>
        <div className="row">
          <span>Wind</span>
          <span>{weather.windStrength.toFixed(2)}</span>
        </div>
        <div className="row">
          <span>Health</span>
          <span>
            {hp.hp}/{hp.max}
            {hp.dead ? " (dead)" : ""}
          </span>
        </div>
      </section>

      <section>
        <h4>Time scale</h4>
        <div className="btns">
          {SCALES.map((s) => (
            <button
              key={s.label}
              type="button"
              className={
                (s.value === 0 && world.paused) ||
                (s.value !== 0 && !world.paused && world.timeScale === s.value)
                  ? "active"
                  : ""
              }
              onClick={() => {
                if (s.value === 0) {
                  setPaused(true);
                } else {
                  setPaused(false);
                  setTimeScale(s.value);
                }
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4>Jump to season</h4>
        <div className="btns">
          {(["Spring", "Summer", "Autumn", "Winter"] as const).map((n, i) => (
            <button
              key={n}
              type="button"
              onClick={() => jumpToSeason(((i + 0) as SeasonIndex))}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4>Force weather</h4>
        <div className="btns">
          <button
            type="button"
            className={forced === "auto" ? "active" : ""}
            onClick={() => {
              setForcedLocal("auto");
              releaseForcedWeather();
            }}
          >
            Auto
          </button>
          {WEATHERS.map((w) => (
            <button
              key={w}
              type="button"
              className={forced === w ? "active" : ""}
              onClick={() => {
                setForcedLocal(w);
                forceWeather(w);
              }}
            >
              {WEATHER_LABELS[w]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4>Actions</h4>
        <div className="btns">
          <button type="button" onClick={() => fireCommand("lightning:now")}>
            Strike lightning
          </button>
          <button type="button" onClick={() => fireCommand("tornado:now")}>
            Spawn tornado
          </button>
          <button type="button" onClick={() => fireCommand("tornado:cancel")}>
            Cancel tornado
          </button>
          <button
            type="button"
            onClick={() => {
              health.respawn();
              fireCommand("player:respawn");
            }}
          >
            Respawn player
          </button>
          <button
            type="button"
            onClick={() => {
              worldState.reset();
              inventory.reset();
              fireCommand("world:reset");
            }}
          >
            Reset destruction
          </button>
          <button
            type="button"
            onClick={() => {
              resetWorldClock();
            }}
          >
            Reset clock
          </button>
        </div>
      </section>
    </div>
  );
}
