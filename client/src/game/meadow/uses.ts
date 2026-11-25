// The things the keeper can use with Space, and how close the keeper must stand.
import type { UiKey } from "../../content/text";
import { TREE_X, TREE_Y } from "./layout";
import {
  BERRY_COL,
  BERRY_ROW,
  CAVE_COL,
  CAVE_ROW,
  COAL_COL,
  COAL_ROW,
  NELL_COL,
  NELL_ROW,
  ORE_COL,
  ORE_ROW,
  ROCK_COL,
  ROCK_ROW,
  footX,
  footY,
} from "./sites";

export type Act = "chop" | "door" | "talk";

export interface Use {
  act: Act;
  x: number;
  y: number;
  /** Gather node ID (0 birch, 1 rock, 2 coal, 3 ore, 4 berry). */
  node?: number;
  /** Px from the keeper's feet to (x,y) within which Space works. Chop matches the chain's 24. */
  reach: number;
  /** How far above (x,y) the hint floats, px. */
  lift: number;
  hint: UiKey;
}

export const USES: readonly Use[] = [
  { act: "chop", node: 0, x: TREE_X, y: TREE_Y, reach: 24, lift: 56, hint: "chopHint" },
  { act: "chop", node: 1, x: footX(ROCK_COL), y: footY(ROCK_ROW), reach: 24, lift: 24, hint: "rockHint" },
  { act: "chop", node: 2, x: footX(COAL_COL), y: footY(COAL_ROW), reach: 24, lift: 24, hint: "coalHint" },
  { act: "chop", node: 3, x: footX(ORE_COL), y: footY(ORE_ROW), reach: 24, lift: 24, hint: "oreHint" },
  { act: "chop", node: 4, x: footX(BERRY_COL), y: footY(BERRY_ROW), reach: 24, lift: 24, hint: "berryHint" },
  { act: "door", x: footX(CAVE_COL), y: footY(CAVE_ROW), reach: 22, lift: 48, hint: "doorHint" },
  { act: "talk", x: footX(NELL_COL), y: footY(NELL_ROW), reach: 22, lift: 30, hint: "nellHint" },
];

/** The nearest usable thing within its reach of (x,y), if any. */
export function useAt(x: number, y: number): Use | undefined {
  let best: Use | undefined;
  let bestGap = Infinity;
  for (const use of USES) {
    const gap = Math.hypot(x - use.x, y - use.y);
    if (gap <= use.reach && gap < bestGap) {
      best = use;
      bestGap = gap;
    }
  }
  return best;
}
