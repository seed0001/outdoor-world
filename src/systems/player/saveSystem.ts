import type { DeviceMode } from "../../deviceMode";
import type { PlayMode } from "../settings/playMode";
import type { RunStatsData } from "./runStats";
import type { WorldStateSaveData } from "../world/worldState";
import { inventory, type InventoryItem } from "./inventory";
import { health } from "./health";
import { vitals } from "./vitals";
import { worldState } from "../world/worldState";
import { snapshot, setSimMs } from "../world/worldClock";
import { runStats } from "./runStats";
import { runGoal } from "../world/runGoal";

const SAVE_KEY = "outdoor-world-v1";

interface SaveData {
  version: 1;
  deviceMode: DeviceMode;
  playMode: PlayMode;
  simMs: number;
  hp: number;
  vitals: { food: number; water: number; sanity: number };
  inventory: Record<string, number>;
  worldStateSave: WorldStateSaveData;
  runStats: RunStatsData;
  runGoalStartSimMs: number;
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

export function saveGame(deviceMode: DeviceMode, playMode: PlayMode): void {
  const snap = snapshot();
  const v = vitals.get();
  const data: SaveData = {
    version: 1,
    deviceMode,
    playMode,
    simMs: snap.simMs,
    hp: health.get().hp,
    vitals: { food: v.food, water: v.water, sanity: v.sanity },
    inventory: { ...(inventory.get() as Record<string, number>) },
    worldStateSave: worldState.getSaveData(),
    runStats: runStats.get(),
    runGoalStartSimMs: runGoal.get().startSimMs,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota — silently ignore
  }
}

export function applySave(data: SaveData): void {
  // Reset all state first, then restore saved values
  worldState.reset();
  health.respawn(); // also resets vitals
  inventory.reset();

  // Restore clock
  setSimMs(data.simMs);

  // Restore health
  health.restoreFromSave(data.hp);

  // Restore vitals
  vitals.restoreFromSave(data.vitals.food, data.vitals.water, data.vitals.sanity);

  // Restore inventory
  for (const [k, v] of Object.entries(data.inventory)) {
    if (v > 0) inventory.add(k as InventoryItem, v);
  }

  // Restore world mutations
  worldState.restoreSaveData(data.worldStateSave);

  // Restore run tracking
  if (data.runStats) runStats.load(data.runStats);
  runGoal.start(data.runGoalStartSimMs);
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

/** Queue a save data to be applied when the next GameRoot mounts. */
let pendingLoad: SaveData | null = null;
export function queueSaveLoad(data: SaveData) {
  pendingLoad = data;
}
export function consumePendingSave(): SaveData | null {
  const d = pendingLoad;
  pendingLoad = null;
  return d;
}
