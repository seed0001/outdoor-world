import type { WeatherType } from "../systems/weather/types";

const GLYPHS: Record<WeatherType, string> = {
  clear: "☀",
  cloudy: "☁",
  rain: "🌧",
  hail: "🌨",
  thunderstorm: "⛈",
  snow: "❄",
  blizzard: "❄",
  tornado: "🌪",
};

export default function WeatherIcon({ type }: { type: WeatherType }) {
  return (
    <span className="weather-icon" aria-hidden>
      {GLYPHS[type]}
    </span>
  );
}
