import { useEffect, useRef, useState } from "react";
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
import { useInventory } from "../systems/player/inventory";
import {
  isBackpackOpen,
  setBackpackOpen,
  subscribeBackpack,
} from "../systems/ui/backpackState";
import { fireCommand } from "../systems/world/commands";
import { playBagZipSfx } from "../systems/audio/gameAudio";
import { releasePointerLockForUI } from "../systems/ui/pointerLock";
import WeatherIcon from "./WeatherIcon";
import Compass from "./Compass";

/** Put your sticks artwork at `public/images/inventory/sticks-bundle.png`. */
const STICKS_ICON_URL = "/images/inventory/sticks-bundle.png";

function BackpackStickCell({ qty }: { qty: number }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <>
      {imgOk ? (
        <img
          className="backpack-cell__icon"
          src={STICKS_ICON_URL}
          alt=""
          draggable={false}
          onError={() => setImgOk(false)}
        />
      ) : (
        <span className="backpack-cell__name">Stk</span>
      )}
      <span className="backpack-cell__qty mono">{qty}</span>
    </>
  );
}

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
  const inv = useInventory();
  const [backpackOpen, setBackpackOpenState] = useState(isBackpackOpen);
  const prevBackpackOpen = useRef<boolean | undefined>(undefined);
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

  useEffect(() => {
    return subscribeBackpack(() => setBackpackOpenState(isBackpackOpen()));
  }, []);

  useEffect(() => {
    if (hp.dead) setBackpackOpen(false);
  }, [hp.dead]);

  useEffect(() => {
    if (hp.dead) releasePointerLockForUI();
  }, [hp.dead]);

  useEffect(() => {
    if (prevBackpackOpen.current === undefined) {
      prevBackpackOpen.current = backpackOpen;
      return;
    }
    if (prevBackpackOpen.current !== backpackOpen) {
      playBagZipSfx();
      prevBackpackOpen.current = backpackOpen;
    }
  }, [backpackOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hp.dead) return;
      if (e.code === "KeyI") {
        if (e.repeat) return;
        e.preventDefault();
        const next = !isBackpackOpen();
        setBackpackOpen(next);
        if (next) releasePointerLockForUI();
        return;
      }
      if (e.code === "Escape" && isBackpackOpen()) {
        e.preventDefault();
        setBackpackOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [hp.dead]);

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
      {locked && !backpackOpen && !hp.dead && (
        <div className="crosshair" aria-hidden />
      )}

      <div
        className="damage-vignette"
        style={{ opacity: hitFlash * 0.8 }}
        aria-hidden
      />

      {locked && !hp.dead && !backpackOpen && <Compass />}

      {locked && !hp.dead && !backpackOpen && (
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

      {locked && !hp.dead && !backpackOpen && (
        <div className="backpack-hint" aria-hidden>
          <kbd>I</kbd> backpack
        </div>
      )}

      {backpackOpen && !hp.dead && (
        <div className="backpack" role="dialog" aria-label="Backpack">
          <header>
            <strong>Backpack</strong>
            <button
              type="button"
              onClick={() => setBackpackOpen(false)}
              aria-label="Close backpack"
            >
              ×
            </button>
          </header>
          <section className="backpack-section">
            <div className="backpack-grid" aria-label="Inventory grid">
              {Array.from({ length: 144 }, (_, i) => {
                const col = i % 12;
                const row = Math.floor(i / 12);
                const isStick = row === 0 && col === 0;
                const isStone = row === 0 && col === 1;
                const reserved = isStick || isStone;
                const qty = isStick ? inv.stick : isStone ? inv.stone : 0;
                const filled = reserved && qty > 0;
                return (
                  <div
                    key={i}
                    className={`backpack-cell${reserved ? " backpack-cell--reserved" : ""}${filled ? " backpack-cell--filled" : ""}`}
                    title={
                      isStick
                        ? "Sticks"
                        : isStone
                          ? "Stone"
                          : `Slot ${row + 1},${col + 1}`
                    }
                  >
                    {isStick ? (
                      <BackpackStickCell qty={qty} />
                    ) : isStone ? (
                      <>
                        <span className="backpack-cell__name">Stn</span>
                        <span className="backpack-cell__qty mono">{qty}</span>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
          <footer className="backpack-footer muted">
            Press <kbd>I</kbd> or <kbd>Esc</kbd> to close
          </footer>
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
            <kbd>LMB</kbd>
          </span>
          <span>chop / gather</span>
          <span>
            <kbd>F1</kbd>
          </span>
          <span>dev panel</span>
          <span>
            <kbd>F3</kbd>
          </span>
          <span>ecosystem</span>
          <span>
            <kbd>I</kbd>
          </span>
          <span>backpack</span>
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
