export type TreeInspectTarget =
  | { mode: "standing"; treeId: number }
  | { mode: "fallen"; treeId: number }
  | null;

const LS_ENABLED_KEY = "treeInspectEnabled";

function readStoredEnabled(): boolean {
  try {
    const v = localStorage.getItem(LS_ENABLED_KEY);
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

let enabled = readStoredEnabled();
const enableListeners = new Set<() => void>();

let target: TreeInspectTarget = null;
const listeners = new Set<() => void>();

function sameTarget(a: TreeInspectTarget, b: TreeInspectTarget): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.mode === b.mode && a.treeId === b.treeId;
}

export function setTreeInspectTarget(next: TreeInspectTarget) {
  if (sameTarget(target, next)) return;
  target = next;
  listeners.forEach((l) => l());
}

export function getTreeInspectTarget(): TreeInspectTarget {
  return target;
}

export function subscribeTreeInspect(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getTreeInspectEnabled(): boolean {
  return enabled;
}

export function setTreeInspectEnabled(next: boolean) {
  if (enabled === next) return;
  enabled = next;
  try {
    localStorage.setItem(LS_ENABLED_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  enableListeners.forEach((l) => l());
  if (!next) {
    setTreeInspectTarget(null);
  }
}

export function toggleTreeInspectEnabled(): boolean {
  setTreeInspectEnabled(!enabled);
  return enabled;
}

export function subscribeTreeInspectEnabled(cb: () => void): () => void {
  enableListeners.add(cb);
  return () => {
    enableListeners.delete(cb);
  };
}
