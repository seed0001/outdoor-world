import { health } from "../player/health";
import { isPaused, onTick, snapshot } from "../world/worldClock";

const URL_BIRD = "/audio/bird-day.wav";
const URL_NIGHT = "/audio/nighttime.mp3";
const URL_WALK = "/audio/walking-brush.wav";
const URL_AXE = "/audio/axe-chop.wav";
const URL_ZIP = "/audio/bag-zip.mp3";

let unlocked = false;
const bird = new Audio(URL_BIRD);
const night = new Audio(URL_NIGHT);
const walk = new Audio(URL_WALK);

bird.loop = true;
night.loop = true;
walk.loop = true;
bird.preload = "auto";
night.preload = "auto";
walk.preload = "auto";

/** Call once after user gesture so loops can play (browser autoplay policy). */
export function unlockGameAudio() {
  if (unlocked) return;
  unlocked = true;
  bird.volume = 0;
  night.volume = 0;
  walk.volume = 0;
  void bird.play().catch(() => {});
  void night.play().catch(() => {});
  void walk.play().catch(() => {});
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Same solar phase as `Sky.tsx`: dayFrac 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 0 = midnight.
 * `sunDir.y` there is `sin(dayTheta)` with `dayTheta = (dayFrac - 0.25) * 2π`.
 */
function sunElevationY(dayFrac: number): number {
  const dayTheta = (dayFrac - 0.25) * Math.PI * 2;
  return Math.sin(dayTheta);
}

/** 0 = full night, 1 = full day — matches sky `nightFactor` / `dayFactor` shape. */
function nightStrength01(dayFrac: number): number {
  const elev = sunElevationY(dayFrac);
  return clamp(-elev * 3 + 0.05, 0, 1);
}

function dayStrength01(dayFrac: number): number {
  const elev = sunElevationY(dayFrac);
  return clamp(elev * 4 + 0.1, 0, 1);
}

let lastChopSfx = 0;
const CHOP_SFX_COOLDOWN_MS = 280;

export function playWoodChopSfx() {
  if (!unlocked) return;
  const now = performance.now();
  if (now - lastChopSfx < CHOP_SFX_COOLDOWN_MS) return;
  lastChopSfx = now;
  const a = new Audio(URL_AXE);
  a.volume = 0.55;
  void a.play().catch(() => {});
}

export function playBagZipSfx() {
  if (!unlocked) return;
  const a = new Audio(URL_ZIP);
  a.volume = 0.45;
  void a.play().catch(() => {});
}

/** Grounded movement foley: volume from horizontal speed + keys. */
export function updateWalkingFoley(opts: {
  locked: boolean;
  grounded: boolean;
  dead: boolean;
  horizSpeed: number;
  wantsMove: boolean;
}) {
  if (!unlocked || opts.dead || isPaused() || health.get().dead) {
    walk.volume = 0;
    return;
  }
  if (!opts.locked || !opts.grounded || !opts.wantsMove) {
    walk.volume *= 0.88;
    if (walk.volume < 0.02) walk.volume = 0;
    return;
  }
  const t = Math.min(
    1,
    Math.max(0, (opts.horizSpeed - 0.35) / (8.5 - 0.35)),
  );
  const target = t * 0.42;
  walk.volume += (target - walk.volume) * 0.12;
}

function refreshAmbienceVolumes() {
  if (!unlocked) return;
  if (health.get().dead || isPaused()) {
    bird.volume = 0;
    night.volume = 0;
    return;
  }
  const { dayFrac } = snapshot();
  const n = nightStrength01(dayFrac);
  const d = dayStrength01(dayFrac);
  // Birds follow daylight; night track follows darkness (MP3 — keep level audible).
  const birdTarget = Math.pow(d, 1.25) * (1 - n * 0.92) * 0.36;
  const nightTarget = Math.pow(n, 0.95) * 0.52;
  const k = 0.1;
  bird.volume += (birdTarget - bird.volume) * k;
  night.volume += (nightTarget - night.volume) * k;
}

onTick((_dt, _snap) => {
  refreshAmbienceVolumes();
});
