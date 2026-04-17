import {
  MONTHS,
  SEASON_NAMES,
  type SeasonIndex,
  type WorldTimeSnapshot,
} from "./worldClock";

/** Returns the season label given a month index. */
export function seasonForMonth(monthIndex: number): SeasonIndex {
  // Dec/Jan/Feb = Winter, Mar/Apr/May = Spring, Jun/Jul/Aug = Summer, Sep/Oct/Nov = Autumn.
  // But our seasonIndex from worldClock is derived from yearFrac*4 with Jan=0, so:
  //   seasonIndex 0 (Jan-Mar)  ~ late winter + early spring
  //   seasonIndex 1 (Apr-Jun)  ~ spring/early summer
  //   seasonIndex 2 (Jul-Sep)  ~ summer/early autumn
  //   seasonIndex 3 (Oct-Dec)  ~ autumn/early winter
  // For the visible "Season" label we want traditional groupings.
  if (monthIndex >= 2 && monthIndex <= 4) return 0; // Mar-May Spring -> 0
  if (monthIndex >= 5 && monthIndex <= 7) return 1; // Jun-Aug Summer -> 1
  if (monthIndex >= 8 && monthIndex <= 10) return 2; // Sep-Nov Autumn -> 2
  return 3; // Dec/Jan/Feb Winter -> 3
}

export function seasonName(seasonIndex: SeasonIndex): (typeof SEASON_NAMES)[number] {
  return SEASON_NAMES[seasonIndex];
}

export function monthName(monthIndex: number): (typeof MONTHS)[number] {
  return MONTHS[((monthIndex % 12) + 12) % 12];
}

/**
 * Continuous 0..1 value tracking the traditional seasonal arc, offset so
 * that 0 = start of spring and 1 = end of winter. Smoother than the raw
 * seasonIndex from the clock.
 */
export function yearPhase(yearFrac: number): number {
  // yearFrac=0 is Jan 1 (mid-winter). Shift so 0 = March 1 (start of spring).
  return (yearFrac - 2 / 12 + 1) % 1;
}

/**
 * 0..1 "how much foliage the trees have". 1 = full leaves.
 *   winter: ~0 (bare)
 *   early spring: climbs to 1
 *   summer: 1
 *   autumn: drops to 0 as leaves fall
 */
export function foliageLevel(yearFrac: number): number {
  const p = yearPhase(yearFrac); // 0=spring, 0.25=summer, 0.5=autumn, 0.75=winter
  if (p < 0.15) {
    // budding out through March/April
    return smoothstep(0.02, 0.15, p);
  }
  if (p < 0.55) {
    // full foliage spring/summer/early autumn
    return 1;
  }
  if (p < 0.72) {
    // autumn drop: 0.55 -> 0.72
    return 1 - smoothstep(0.55, 0.72, p);
  }
  return 0; // winter bare
}

/** 0..1 color-tone through the year. 0=spring-green,0.3=deep-green,0.55=yellow,0.65=orange,0.72=bare */
export function foliageHuePhase(yearFrac: number, perTreeOffset = 0): number {
  const p = yearPhase(yearFrac) + perTreeOffset;
  return (p % 1 + 1) % 1;
}

/**
 * 0..1 "snow on the ground" target. Driven purely by date (weather adds on top).
 *   winter: ~1
 *   late autumn and early spring taper.
 */
export function snowTarget(yearFrac: number): number {
  const p = yearPhase(yearFrac);
  if (p < 0.08) return smoothstep(0.08, 0, p); // early spring melting
  if (p < 0.72) return 0;
  if (p < 0.8) return smoothstep(0.72, 0.8, p); // late autumn building
  return 1; // winter
}

/** Degrees Celsius given the current world time and optional elevation in metres. */
export function temperatureC(
  snap: WorldTimeSnapshot,
  elevation = 0,
  weatherMod = 0,
): number {
  // Annual sinusoid. Offset so coldest is mid-winter (yearPhase ~0.875 => Jan 15ish).
  const p = yearPhase(snap.yearFrac);
  // peak at p = 0.25 (July), trough at p = 0.75 (January)
  const annual = Math.sin((p - 0.25) * Math.PI * 2) * 22 + 8; // ranges ~-14..+30
  // Daily: cold at 4am, warm at 3pm.
  const daily = Math.sin((snap.dayFrac - 0.17) * Math.PI * 2) * 5;
  // Lapse rate: -6.5C per 1000m above sea level (our world y is small so this is mild)
  const lapse = -elevation * 0.0065;
  return annual + daily + lapse + weatherMod;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
