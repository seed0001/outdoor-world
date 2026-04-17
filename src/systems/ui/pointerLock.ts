/** Exit pointer lock so the OS cursor is visible for menus, settings, dev UI, etc. */
export function releasePointerLockForUI(): void {
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
}
