import { useEffect, useState } from "react";
import { useWorldTime } from "../systems/world/worldClock";
import { temperatureC } from "../systems/world/calendar";
import {
  computeWoodHarvestTraits,
  craftingDirectionsForKind,
  treeKindEcologyBlurb,
  treeKindName,
} from "../systems/world/woodEcology";
import { getWeather } from "../systems/weather/weatherSystem";
import { playerRef } from "../systems/player/playerRef";
import { trees as treeList } from "../systems/world/treeRegistry";
import { worldState } from "../systems/world/worldState";
import {
  getTreeInspectEnabled,
  getTreeInspectTarget,
  subscribeTreeInspect,
  subscribeTreeInspectEnabled,
  toggleTreeInspectEnabled,
  type TreeInspectTarget,
} from "../systems/ui/treeInspectState";
import { isBackpackOpen } from "../systems/ui/backpackState";

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function useInspectTarget(): TreeInspectTarget {
  const [t, setT] = useState<TreeInspectTarget>(() => getTreeInspectTarget());
  useEffect(() => subscribeTreeInspect(() => setT(getTreeInspectTarget())), []);
  return t;
}

function useTreeInspectEnabled(): boolean {
  const [v, setV] = useState(() => getTreeInspectEnabled());
  useEffect(
    () => subscribeTreeInspectEnabled(() => setV(getTreeInspectEnabled())),
    [],
  );
  return v;
}

export default function TreeInspectPopup() {
  const target = useInspectTarget();
  const enabled = useTreeInspectEnabled();
  const world = useWorldTime(6);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyT" || e.repeat) return;
      const el = e.target;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      if (isBackpackOpen()) return;
      e.preventDefault();
      toggleTreeInspectEnabled();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!enabled || !target) return null;

  const spec =
    target.mode === "standing"
      ? treeList.find((x) => x.id === target.treeId)
      : null;
  const fallen =
    target.mode === "fallen"
      ? worldState.listFallenTrees().find((x) => x.id === target.treeId)
      : null;

  const kind = spec?.kind ?? fallen?.kind;
  if (kind === undefined) return null;

  const w = getWeather();
  const traits = computeWoodHarvestTraits(kind, world, {
    elevation: playerRef.position.y,
    weatherTempMod: w.tempMod,
  });
  const airC = temperatureC(world, playerRef.position.y, w.tempMod);
  const directions = craftingDirectionsForKind(kind);

  const title =
    target.mode === "standing"
      ? `${treeKindName(kind)} · tree #${target.treeId}`
      : `${treeKindName(kind)} · fallen #${target.treeId}`;

  return (
    <div className="tree-inspect-popup" role="status" aria-live="polite">
      <header className="tree-inspect-popup__head">
        <span className="tree-inspect-popup__title">{title}</span>
        <span className="tree-inspect-popup__badge">
          {target.mode === "standing" ? "Standing" : "Fallen"}
        </span>
      </header>

      <p className="tree-inspect-popup__blurb">{treeKindEcologyBlurb(kind)}</p>

      {spec && (
        <section className="tree-inspect-popup__section">
          <h4 className="tree-inspect-popup__h">Growth</h4>
          <ul className="tree-inspect-popup__stats mono">
            <li>
              <span>Trunk H</span>
              <span>{spec.trunkHeight.toFixed(2)} m</span>
            </li>
            <li>
              <span>Crown H</span>
              <span>{spec.foliageHeight.toFixed(2)} m</span>
            </li>
            <li>
              <span>Crown R</span>
              <span>{spec.foliageRadius.toFixed(2)} m</span>
            </li>
            <li>
              <span>Trunk R</span>
              <span>{spec.trunkRadius.toFixed(2)} m</span>
            </li>
            <li>
              <span>Scale</span>
              <span>{spec.scale.toFixed(2)}</span>
            </li>
          </ul>
        </section>
      )}

      {fallen && (
        <section className="tree-inspect-popup__section">
          <h4 className="tree-inspect-popup__h">Fallen geometry</h4>
          <ul className="tree-inspect-popup__stats mono">
            <li>
              <span>Trunk H</span>
              <span>{fallen.trunkHeight.toFixed(2)} m</span>
            </li>
            <li>
              <span>Crown H</span>
              <span>{fallen.foliageHeight.toFixed(2)} m</span>
            </li>
            <li>
              <span>Crown R</span>
              <span>{fallen.foliageRadius.toFixed(2)} m</span>
            </li>
          </ul>
        </section>
      )}

      <section className="tree-inspect-popup__section">
        <h4 className="tree-inspect-popup__h">Material (now)</h4>
        <p className="tree-inspect-popup__context mono">
          Air {airC.toFixed(1)}°C · traits shift with season, time, weather
        </p>
        <ul className="tree-inspect-popup__traits">
          <li>
            <span>Durability</span>
            <span className="tree-inspect-popup__bar-wrap">
              <span
                className="tree-inspect-popup__bar"
                style={{ width: pct(traits.durability) }}
              />
            </span>
            <span className="mono">{pct(traits.durability)}</span>
          </li>
          <li>
            <span>Flammability</span>
            <span className="tree-inspect-popup__bar-wrap">
              <span
                className="tree-inspect-popup__bar tree-inspect-popup__bar--fire"
                style={{ width: pct(traits.flammability) }}
              />
            </span>
            <span className="mono">{pct(traits.flammability)}</span>
          </li>
          <li>
            <span>Refinement</span>
            <span className="tree-inspect-popup__bar-wrap">
              <span
                className="tree-inspect-popup__bar tree-inspect-popup__bar--refine"
                style={{ width: pct(traits.refinement) }}
              />
            </span>
            <span className="mono">{pct(traits.refinement)}</span>
          </li>
          <li>
            <span>Flexibility</span>
            <span className="tree-inspect-popup__bar-wrap">
              <span
                className="tree-inspect-popup__bar tree-inspect-popup__bar--flex"
                style={{ width: pct(traits.flexibility) }}
              />
            </span>
            <span className="mono">{pct(traits.flexibility)}</span>
          </li>
          <li>
            <span>Energy / resin</span>
            <span className="tree-inspect-popup__bar-wrap">
              <span
                className="tree-inspect-popup__bar tree-inspect-popup__bar--sap"
                style={{ width: pct(traits.energyResin) }}
              />
            </span>
            <span className="mono">{pct(traits.energyResin)}</span>
          </li>
          <li>
            <span>Moisture</span>
            <span className="tree-inspect-popup__bar-wrap">
              <span
                className="tree-inspect-popup__bar tree-inspect-popup__bar--wet"
                style={{ width: pct(traits.moisture) }}
              />
            </span>
            <span className="mono">{pct(traits.moisture)}</span>
          </li>
          <li>
            <span>Freshness</span>
            <span className="tree-inspect-popup__bar-wrap">
              <span
                className="tree-inspect-popup__bar tree-inspect-popup__bar--fresh"
                style={{ width: pct(traits.freshness) }}
              />
            </span>
            <span className="mono">{pct(traits.freshness)}</span>
          </li>
        </ul>
        {traits.tags.length > 0 && (
          <p className="tree-inspect-popup__tags">
            {traits.tags.map((tag) => (
              <span key={tag} className="tree-inspect-popup__tag">
                {tag}
              </span>
            ))}
          </p>
        )}
      </section>

      <section className="tree-inspect-popup__section">
        <h4 className="tree-inspect-popup__h">Crafting directions</h4>
        {directions.map((block) => (
          <div key={block.title} className="tree-inspect-popup__craft-block">
            <div className="tree-inspect-popup__craft-title">{block.title}</div>
            <ul className="tree-inspect-popup__craft-list">
              {block.items.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
