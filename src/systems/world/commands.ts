type CommandKind =
  | "lightning:now"
  | "tornado:now"
  | "tornado:cancel"
  | "world:reset"
  | "player:respawn";

const listeners = new Map<CommandKind, Set<() => void>>();

export function onCommand(
  kind: CommandKind,
  cb: () => void,
): () => void {
  let set = listeners.get(kind);
  if (!set) {
    set = new Set();
    listeners.set(kind, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
  };
}

export function fireCommand(kind: CommandKind) {
  listeners.get(kind)?.forEach((cb) => cb());
}
