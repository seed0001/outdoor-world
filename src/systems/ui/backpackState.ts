let backpackOpen = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function isBackpackOpen(): boolean {
  return backpackOpen;
}

export function setBackpackOpen(next: boolean) {
  if (backpackOpen === next) return;
  backpackOpen = next;
  emit();
}

export function subscribeBackpack(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
