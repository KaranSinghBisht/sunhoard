// The opening: five lines of the tale, each told over a different corner of the Vale.
// The lines are STORY.md §3.1 and §7; the camera glides from one place to the next.
import type { UiKey } from "../../content/text";
import { TILE } from "../meadow/layout";
import { ARRIVE_X, ARRIVE_Y } from "./quest";

export interface Beat {
  text: UiKey;
  /** Where the camera looks, px on the meadow. */
  x: number;
  y: number;
  /** Rings the noon-hole in the sky while this line is up. */
  sky?: boolean;
  /** The Keeper walks in from the edge of the map during this line. */
  walkIn?: boolean;
}

function tile(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE, y: row * TILE };
}

export const BEATS: readonly Beat[] = [
  { text: "intro1", ...tile(11, 9) },
  { text: "intro6", ...tile(35, 7), sky: true },
  { text: "loreBlocks", ...tile(24, 31) },
  { text: "loreHoard", ...tile(25, 17) },
  { text: "loreKeeper", x: ARRIVE_X, y: ARRIVE_Y, walkIn: true },
];

/** How long a line stays up before the tale moves on by itself, ms. */
export const BEAT_MS = 7000;
