/** Diffuse maps from `public/models/colored-flower/textures/`. */
export const COLORED_FLOWER_TEXTURE_URLS = [
  "/models/colored-flower/textures/petal17.png",
  "/models/colored-flower/textures/petal25.png",
  "/models/colored-flower/textures/petal26.png",
  "/models/colored-flower/textures/petal34.png",
  "/models/colored-flower/textures/grass4.png",
  "/models/colored-flower/textures/grass109.png",
  "/models/colored-flower/textures/grass110.png",
] as const;

export const COLORED_FLOWER_VARIANT_COUNT = COLORED_FLOWER_TEXTURE_URLS.length;

/** Petal chip colors matched to each colored-flower diffuse variant. */
export const COLORED_FLOWER_PETAL_COLORS = [
  "#e878b8",
  "#f0b848",
  "#e85078",
  "#d070d0",
  "#6aaa48",
  "#8cc858",
  "#a8d868",
] as const;

export const WILDFLOWER_CHIP_COLORS = [
  "#f0a8c8",
  "#f8d878",
  "#e890b0",
  "#fff0a8",
] as const;

export const ROSE_CHIP_COLORS = ["#d84868", "#f07898", "#c03050", "#ffb0c0"] as const;
