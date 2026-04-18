let grillOpen = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function isCampfireGrillOpen(): boolean {
  return grillOpen;
}

export function setCampfireGrillOpen(next: boolean): void {
  if (grillOpen === next) return;
  grillOpen = next;
  emit();
}

export function toggleCampfireGrill(): void {
  grillOpen = !grillOpen;
  emit();
}

export function subscribeCampfireGrill(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
