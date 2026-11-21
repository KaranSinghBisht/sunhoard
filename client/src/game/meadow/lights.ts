// Lantern light. A light punches a hole in the night grade and thaws the snow
// under it (docs/ART.md "How Sunhoard's look is made"). The road is trodden to
// bare earth all along, so it counts as thawed too.
import { TILE, isRoad } from "./layout";

export interface Light {
  x: number;
  y: number;
  /** Radius of the hole in the night grade, px. */
  radius: number;
  /** Radius of the thawed ground, px. Zero for a light that melts nothing. */
  thaw: number;
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const INNER = 0.68;
const VERGE = 8;

function ring(raw: number): number {
  return Math.ceil(raw * 4) / 4;
}

function lampLevel(x: number, y: number, light: Light): number {
  if (light.thaw <= 0) return 0;
  const wobble = 4 * Math.sin(x * 0.19 + light.y) * Math.cos(y * 0.23 + light.x);
  const distance = Math.hypot(x - light.x, (y - light.y) * 1.25) + wobble;
  if (distance >= light.thaw) return 0;
  const inner = light.thaw * INNER;
  return distance <= inner ? 1 : ring(1 - (distance - inner) / (light.thaw - inner));
}

/** Px from a point to the nearest road tile among the nine around it; Infinity if none. */
function roadGap(x: number, y: number): number {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  let nearest = Infinity;
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (!isRoad(c, r)) continue;
      const dx = Math.max(c * TILE - x, 0, x - (c * TILE + TILE - 1));
      const dy = Math.max(r * TILE - y, 0, y - (r * TILE + TILE - 1));
      nearest = Math.min(nearest, Math.hypot(dx, dy));
    }
  }
  return nearest;
}

function roadLevel(x: number, y: number): number {
  const gap = roadGap(x, y);
  if (gap === 0) return 1;
  const wobble = 1.5 * Math.sin(x * 0.37) + 1.5 * Math.cos(y * 0.41);
  const reach = VERGE + wobble;
  return gap >= reach ? 0 : ring(1 - gap / reach);
}

/** How thawed a ground pixel is: 0, 0.25, 0.5, 0.75 or 1. */
export function thawLevel(x: number, y: number, lights: readonly Light[]): number {
  let best = roadLevel(x, y);
  for (const light of lights) best = Math.max(best, lampLevel(x, y, light));
  return best;
}

/** The melt line: an ordered dither keyed to world pixels, so neighbouring tiles line up. */
export function thawed(x: number, y: number, lights: readonly Light[]): boolean {
  const level = thawLevel(x, y, lights);
  if (level <= 0) return false;
  return level * 16 > BAYER[y & 3][x & 3] + 0.5;
}
