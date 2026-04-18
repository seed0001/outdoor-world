import { createXRStore } from "@react-three/xr";

/** Shared store so UI (Enter AR) and the Canvas `<XR>` use the same instance. */
export const xrStore = createXRStore();
