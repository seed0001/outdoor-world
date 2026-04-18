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
import { useVitals, vitals } from "../systems/player/vitals";
import { playerRef } from "../systems/player/playerRef";
import { inventory, useInventory } from "../systems/player/inventory";
import {
  MINERAL_INVENTORY_KEYS,
  MINERAL_NAMES,
  type MineralInventoryKey,
} from "../systems/world/mineralRegistry";
import type { InventoryItem } from "../systems/player/inventory";
import {
  isBackpackOpen,
  setBackpackOpen,
  subscribeBackpack,
} from "../systems/ui/backpackState";
import {
  isCampfireGrillOpen,
  setCampfireGrillOpen,
  subscribeCampfireGrill,
} from "../systems/ui/campfireGrillUi";
import { fireCommand } from "../systems/world/commands";
import { campfires } from "../systems/world/campfires";
import {
  campfireCooking,
  COOK_DURATION_MS,
  CAMPFIRE_INTERACT_RADIUS,
  GRID_DIM,
  type GrillCell,
} from "../systems/world/campfireCooking";
import { playBagZipSfx } from "../systems/audio/gameAudio";
import { releasePointerLockForUI } from "../systems/ui/pointerLock";
import WeatherIcon from "./WeatherIcon";
import Compass from "./Compass";

/** Put your sticks artwork at `public/images/inventory/sticks-bundle.png`. */
const STICKS_ICON_URL = "/images/inventory/sticks-bundle.png";

const MINERAL_ABBREV = ["Fe", "Cu", "Qz", "S", "Na"] as const;

const MEAT_ROW: { key: InventoryItem; title: string; abbr: string }[] = [
  { key: "raw_rat", title: "Raw rat", abbr: "rRt" },
  { key: "raw_snake", title: "Raw snake", abbr: "rSn" },
  { key: "raw_fish", title: "Raw fish", abbr: "rFi" },
  { key: "cooked_rat", title: "Cooked rat", abbr: "Rt" },
  { key: "cooked_snake", title: "Cooked snake", abbr: "Sn" },
  { key: "cooked_fish", title: "Cooked fish", abbr: "Fi" },
];

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

function grillCellAbbr(cell: GrillCell): string {
  if (cell.k === "empty") return "";
  if (cell.k === "cooking") {
    if (cell.raw === "raw_rat") return "R";
    if (cell.raw === "raw_snake") return "S";
    return "F";
  }
  if (cell.cooked === "cooked_rat") return "Rt";
  if (cell.cooked === "cooked_snake") return "Sn";
  return "Fi";
}

const GRILL_COOKED_EAT: InventoryItem[] = [
  "cooked_rat",
  "cooked_snake",
  "cooked_fish",
];
const GRILL_HEAL_EAT = 14;
const GRILL_FOOD_FROM_MEAT = 38;

function CampfireGrillOverlay({ fireId }: { fireId: number }) {
  const [grid, setGrid] = useState(() => campfireCooking.getGrid(fireId));
  const [, setFrame] = useState(0);
  const inv = useInventory();

  useEffect(() => {
    setGrid(campfireCooking.getGrid(fireId));
    return campfireCooking.subscribe(() => {
      setGrid([...campfireCooking.getGrid(fireId)]);
    });
  }, [fireId]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setFrame(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const now = performance.now();
  const hasReady = grid.some((c) => c.k === "ready");
  const hasRaw =
    inv.raw_rat > 0 || inv.raw_snake > 0 || inv.raw_fish > 0;
  const hasCookedBag = GRILL_COOKED_EAT.some((k) => inv[k] > 0);

  const onTakeCooked = () => {
    campfireCooking.tryCollect(fireId);
  };

  const onAddRaw = () => {
    campfireCooking.tryDeposit(fireId);
  };

  const onEatCooked = () => {
    for (const key of GRILL_COOKED_EAT) {
      const part: Partial<Record<InventoryItem, number>> = { [key]: 1 };
      if (!inventory.tryConsume(part)) continue;
      vitals.addFood(GRILL_FOOD_FROM_MEAT);
      health.heal(GRILL_HEAL_EAT);
      return;
    }
  };

  return (
    <div className="campfire-grill" role="dialog" aria-label="Campfire grill">
      <div className="campfire-grill__title">Grill</div>
      <div className="campfire-grill__actions">
        <button
          type="button"
          className="campfire-grill__btn"
          disabled={!hasReady}
          onClick={onTakeCooked}
        >
          Take cooked
        </button>
        <button
          type="button"
          className="campfire-grill__btn"
          disabled={!hasRaw}
          onClick={onAddRaw}
        >
          Add raw
        </button>
        <button
          type="button"
          className="campfire-grill__btn"
          disabled={!hasCookedBag}
          onClick={onEatCooked}
        >
          Eat cooked
        </button>
      </div>
      <div
        className="campfire-grill__grid"
        style={{ gridTemplateColumns: `repeat(${GRID_DIM}, 1fr)` }}
      >
        {grid.map((cell, i) => {
          const pct =
            cell.k === "cooking"
              ? Math.min(
                  100,
                  ((now - cell.startedAt) / COOK_DURATION_MS) * 100,
                )
              : 0;
          return (
            <div
              key={i}
              className={`campfire-grill__cell campfire-grill__cell--${cell.k}`}
              title={
                cell.k === "cooking"
                  ? "Cooking…"
                  : cell.k === "ready"
                    ? "Cooked — use Take cooked"
                    : "Empty"
              }
            >
              {cell.k === "cooking" && (
                <span
                  className="campfire-grill__ring"
                  style={{
                    background: `conic-gradient(from -90deg, #ff9a33 ${pct}%, rgba(32, 22, 16, 0.95) 0)`,
                  }}
                />
              )}
              <span className="campfire-grill__abbr">{grillCellAbbr(cell)}</span>
            </div>
          );
        })}
      </div>
      <div className="campfire-grill__hint muted">
        <kbd>G</kbd> or <kbd>Esc</kbd> to close · click canvas to look again
      </div>
    </div>
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
  const v = useVitals();
  const inv = useInventory();
  const [backpackOpen, setBackpackOpenState] = useState(isBackpackOpen);
  const prevBackpackOpen = useRef<boolean | undefined>(undefined);
  const [weatherTick, setWeatherTick] = useState(0);
  const [grillFireId, setGrillFireId] = useState<number | null>(null);
  const [grillOpen, setGrillOpenState] = useState(isCampfireGrillOpen);

  useEffect(() => {
    return subscribeCampfireGrill(() =>
      setGrillOpenState(isCampfireGrillOpen()),
    );
  }, []);

  useEffect(() => {
    if (hp.dead) setCampfireGrillOpen(false);
  }, [hp.dead]);

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
    const id = window.setInterval(() => {
      const p = playerRef.position;
      const f = campfires.nearest(
        p.x,
        p.y,
        p.z,
        CAMPFIRE_INTERACT_RADIUS,
      );
      const next = f?.id ?? null;
      if (next === null) setCampfireGrillOpen(false);
      setGrillFireId((prev) => (prev === next ? prev : next));
    }, 120);
    return () => window.clearInterval(id);
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
        if (next) setCampfireGrillOpen(false);
        setBackpackOpen(next);
        if (next) releasePointerLockForUI();
        return;
      }
      if (e.code === "Escape" && isCampfireGrillOpen()) {
        e.preventDefault();
        setCampfireGrillOpen(false);
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

  const sinceHit = hp.lastDamageAtMs
    ? performance.now() - hp.lastDamageAtMs
    : Infinity;
  const hitFlash =
    hp.lastDamageAtMs && sinceHit < 350 ? 1 - sinceHit / 350 : 0;

  const hpFrac = hp.max > 0 ? hp.hp / hp.max : 1;
  const lowHealth = !hp.dead && hpFrac < 0.5;
  let damageVignetteOpacity = 0;
  if (lowHealth) {
    const severity = (0.5 - hpFrac) / 0.5;
    const base = 0.16 + severity * 0.44;
    damageVignetteOpacity = Math.min(0.88, base + hitFlash * 0.32);
  }

  return (
    <div className="hud">
      {locked && !backpackOpen && !hp.dead && (
        <div className="crosshair" aria-hidden />
      )}

      <div
        className="damage-vignette"
        style={{ opacity: damageVignetteOpacity }}
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
        <div className="backpack-hint backpack-hint--col" aria-hidden>
          <div>
            <kbd>I</kbd> backpack
          </div>
          <div>
            <kbd>T</kbd> tree info on/off
          </div>
          <div>
            <kbd>F</kbd> place campfire
          </div>
          <div>
            <kbd>G</kbd> open / close fire grill (near fire)
          </div>
          <div>
            <kbd>V</kbd> drink (in lake)
          </div>
          <div>
            <kbd>E</kbd> eat cooked meat
          </div>
          <div>
            <kbd>RMB</kbd> shoot arrow
          </div>
        </div>
      )}

      {!hp.dead && !backpackOpen && grillOpen && grillFireId !== null && (
        <CampfireGrillOverlay fireId={grillFireId} />
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
                const isArrow = row === 0 && col === 7;
                const mineralIndex =
                  row === 0 &&
                  col >= 2 &&
                  col < 2 + MINERAL_INVENTORY_KEYS.length
                    ? col - 2
                    : -1;
                const mineralKey: MineralInventoryKey | null =
                  mineralIndex >= 0
                    ? MINERAL_INVENTORY_KEYS[mineralIndex]
                    : null;
                const meat =
                  row === 1 && col >= 0 && col < MEAT_ROW.length
                    ? MEAT_ROW[col]
                    : null;
                const reserved =
                  isStick ||
                  isStone ||
                  isArrow ||
                  mineralKey !== null ||
                  meat !== null;
                const qty = isStick
                  ? inv.stick
                  : isStone
                    ? inv.stone
                    : isArrow
                      ? inv.arrow
                      : mineralKey
                      ? inv[mineralKey]
                      : meat
                        ? inv[meat.key]
                        : 0;
                const filled = reserved && qty > 0;
                const title = isStick
                  ? "Sticks"
                  : isStone
                    ? "Stone"
                    : isArrow
                      ? "Arrows"
                      : mineralKey
                      ? MINERAL_NAMES[mineralIndex]
                      : meat
                        ? meat.title
                        : `Slot ${row + 1},${col + 1}`;
                return (
                  <div
                    key={i}
                    className={`backpack-cell${reserved ? " backpack-cell--reserved" : ""}${filled ? " backpack-cell--filled" : ""}`}
                    title={title}
                  >
                    {isStick ? (
                      <BackpackStickCell qty={qty} />
                    ) : isStone ? (
                      <>
                        <span className="backpack-cell__name">Stn</span>
                        <span className="backpack-cell__qty mono">{qty}</span>
                      </>
                    ) : isArrow ? (
                      <>
                        <span className="backpack-cell__name">Arr</span>
                        <span className="backpack-cell__qty mono">{qty}</span>
                      </>
                    ) : mineralKey && mineralIndex >= 0 ? (
                      <>
                        <span className="backpack-cell__name">
                          {MINERAL_ABBREV[mineralIndex]}
                        </span>
                        <span className="backpack-cell__qty mono">{qty}</span>
                      </>
                    ) : meat ? (
                      <>
                        <span className="backpack-cell__name">{meat.abbr}</span>
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
        <div className="hud-status-bars" aria-label="Health and vitals">
          <div
            className="stat-bar stat-bar--health"
            title={`Health ${Math.round(hp.hp)} / ${hp.max}`}
          >
            <div
              className="fill"
              style={{
                width: `${Math.min(100, Math.max(0, (hp.hp / hp.max) * 100))}%`,
              }}
            />
            <div className="stat-bar__meta">
              <span className="stat-bar__tag">HP</span>
              <span className="stat-bar__num mono">
                {Math.round(hp.hp)}
              </span>
            </div>
          </div>
          <div
            className="stat-bar stat-bar--food"
            title={`Hunger ${Math.round(v.food)} / ${v.max}`}
          >
            <div
              className="fill"
              style={{
                width: `${Math.min(100, Math.max(0, (v.food / v.max) * 100))}%`,
              }}
            />
            <div className="stat-bar__meta">
              <span className="stat-bar__tag">Eat</span>
              <span className="stat-bar__num mono">{Math.round(v.food)}</span>
            </div>
          </div>
          <div
            className="stat-bar stat-bar--water"
            title={`Thirst ${Math.round(v.water)} / ${v.max}`}
          >
            <div
              className="fill"
              style={{
                width: `${Math.min(100, Math.max(0, (v.water / v.max) * 100))}%`,
              }}
            />
            <div className="stat-bar__meta">
              <span className="stat-bar__tag">H2O</span>
              <span className="stat-bar__num mono">{Math.round(v.water)}</span>
            </div>
          </div>
          <div
            className="stat-bar stat-bar--sanity"
            title={`Sanity ${Math.round(v.sanity)} / ${v.max}`}
          >
            <div
              className="fill"
              style={{
                width: `${Math.min(100, Math.max(0, (v.sanity / v.max) * 100))}%`,
              }}
            />
            <div className="stat-bar__meta">
              <span className="stat-bar__tag">Mind</span>
              <span className="stat-bar__num mono">{Math.round(v.sanity)}</span>
            </div>
          </div>
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
            <kbd>RMB</kbd>
          </span>
          <span>shoot arrow</span>
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
            <kbd>T</kbd>
          </span>
          <span>tree info on/off</span>
          <span>
            <kbd>F</kbd>
          </span>
          <span>campfire</span>
          <span>
            <kbd>G</kbd>
          </span>
          <span>grill near fire</span>
          <span>
            <kbd>V</kbd>
          </span>
          <span>drink in lake</span>
          <span>
            <kbd>E</kbd>
          </span>
          <span>eat cooked</span>
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
