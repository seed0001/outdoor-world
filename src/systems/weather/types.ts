export type WeatherType =
  | "clear"
  | "cloudy"
  | "rain"
  | "hail"
  | "thunderstorm"
  | "snow"
  | "blizzard"
  | "tornado";

export const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  rain: "Rain",
  hail: "Hail",
  thunderstorm: "Thunderstorm",
  snow: "Snow",
  blizzard: "Blizzard",
  tornado: "Tornado",
};

export interface WeatherState {
  /** Current visible weather (the one ramping in or fully active). */
  type: WeatherType;
  /** 0..1, how present the current weather is. */
  intensity: number;
  /** Optional incoming transition. */
  target: WeatherType | null;
  /** 0..1 progress of the transition. */
  transition: number;
  /** Scalar derived values shared with visual systems. */
  rainRate: number;
  hailRate: number;
  snowRate: number;
  windStrength: number;
  lightningRate: number; // strikes per in-game minute
  cloudCoverage: number; // 0..1
  cloudDarkness: number; // 0..1
  wetness: number; // 0..1 lingering ground wetness
  /** Temperature modifier in deg C added by current weather. */
  tempMod: number;
}
