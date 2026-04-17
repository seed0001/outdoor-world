import { useEffect, useState } from "react";
import { MONTHS, useWorldTime } from "../systems/world/worldClock";
import { subscribeWeather } from "../systems/weather/weatherSystem";
import { worldState } from "../systems/world/worldState";
import { getEcosystemSnapshot } from "../systems/world/ecosystemStats";

export default function EcosystemPanel() {
  const [open, setOpen] = useState(false);
  const [wsTick, setWsTick] = useState(0);
  const [weatherTick, setWeatherTick] = useState(0);
  useWorldTime(6);

  useEffect(() => {
    const unsub = worldState.subscribe(() => setWsTick((n) => n + 1));
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeWeather(() => setWeatherTick((n) => n + 1));
    return unsub;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "F2") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  void wsTick;
  void weatherTick;

  const snap = getEcosystemSnapshot();
  const bv = snap.fauna.butterflyVisibility;

  return (
    <>
      <div className="ecopanel-hint">
        <kbd>F2</kbd> ecosystem
      </div>
      {open && (
        <div className="ecopanel">
          <header>
            <strong>Ecosystem</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </header>

          <section>
            <h4>Time</h4>
            <div className="row">
              <span>Month</span>
              <span className="mono">
                {MONTHS[snap.time.monthIndex]} ({snap.time.monthIndex + 1}/12)
              </span>
            </div>
            <div className="row">
              <span>Season index</span>
              <span className="mono">{snap.time.seasonIndex}</span>
            </div>
            <div className="row">
              <span>Tree foliage (0–1)</span>
              <span className="mono">{snap.time.foliageLevel.toFixed(2)}</span>
            </div>
            <div className="row">
              <span>Flower bloom target</span>
              <span className="mono">{snap.flora.flowerBloomTarget.toFixed(2)}</span>
            </div>
          </section>

          <section>
            <h4>Flora</h4>
            <div className="row">
              <span>Trees (standing / spawned)</span>
              <span className="mono">
                {snap.flora.treesStanding} / {snap.flora.treesSpawned}
              </span>
            </div>
            <div className="row">
              <span>Trees fallen (tornado)</span>
              <span className="mono">{snap.flora.treesFallen}</span>
            </div>
            <div className="row">
              <span>Flowers (instances)</span>
              <span className="mono">{snap.flora.flowersPlaced}</span>
            </div>
          </section>

          <section>
            <h4>Fauna</h4>
            <div className="row">
              <span>Snakes</span>
              <span className="mono">{snap.fauna.snakes}</span>
            </div>
            <div className="row">
              <span>Rats</span>
              <span className="mono">{snap.fauna.rats}</span>
            </div>
            <div className="row">
              <span>Fish</span>
              <span className="mono">{snap.fauna.fish}</span>
            </div>
            <div className="row">
              <span>Butterflies (spawned)</span>
              <span className="mono">{snap.fauna.butterfliesSpawned}</span>
            </div>
            <div className="row ecopanel-sub">
              <span>Butterfly visibility</span>
              <span className="mono">{(bv.combined * 100).toFixed(0)}%</span>
            </div>
            <div className="row indent">
              <span>day</span>
              <span className="mono">{(bv.dayFactor * 100).toFixed(0)}%</span>
            </div>
            <div className="row indent">
              <span>season</span>
              <span className="mono">{(bv.seasonFactor * 100).toFixed(0)}%</span>
            </div>
            <div className="row indent">
              <span>weather</span>
              <span className="mono">{(bv.weatherFactor * 100).toFixed(0)}%</span>
            </div>
            <div className="row indent">
              <span>air temp (sim, info)</span>
              <span className="mono">{bv.airTempC.toFixed(1)} °C</span>
            </div>
          </section>

          <section>
            <h4>Geology</h4>
            <div className="row">
              <span>Rocks (static / spawned)</span>
              <span className="mono">
                {snap.geology.rocksStatic} / {snap.geology.rocksSpawned}
              </span>
            </div>
            <div className="row">
              <span>Rocks displaced</span>
              <span className="mono">{snap.geology.rocksDisplaced}</span>
            </div>
          </section>

          <section>
            <h4>Atmosphere & effects</h4>
            <div className="row">
              <span>Cloud billboards</span>
              <span className="mono">{snap.atmosphere.cloudBillboards}</span>
            </div>
            <div className="row">
              <span>Rain particles</span>
              <span className="mono">{snap.atmosphere.rainParticles}</span>
            </div>
            <div className="row">
              <span>Hail particles</span>
              <span className="mono">{snap.atmosphere.hailParticles}</span>
            </div>
            <div className="row">
              <span>Snow particles</span>
              <span className="mono">{snap.atmosphere.snowParticles}</span>
            </div>
            <div className="row">
              <span>Tornado debris</span>
              <span className="mono">{snap.atmosphere.tornadoDebrisParticles}</span>
            </div>
          </section>

          <section>
            <h4>Player</h4>
            <div className="row">
              <span>Humans</span>
              <span className="mono">{snap.player.humans}</span>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
