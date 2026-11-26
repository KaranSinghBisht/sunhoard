// The first night: the walk a new Keeper is led on, one step at a time.
// Pure rules only, so the order can be tested without a canvas.
import type { UiKey } from "../../content/text";
import { START_X, START_Y, TILE, TREE_X, TREE_Y } from "../meadow/layout";
import { CAVE_COL, CAVE_ROW, FIRE_COL, FIRE_ROW, NELL_COL, NELL_ROW, footX, footY } from "../meadow/sites";

export type QuestEvent =
  | { kind: "at"; x: number; y: number }
  | { kind: "chopped" }
  | { kind: "talked" }
  | { kind: "entered" }
  | { kind: "cleared" };

export interface Point {
  x: number;
  y: number;
}

export interface Step {
  id: "road" | "chop" | "nell" | "cellar" | "fight";
  text: UiKey;
  /** Where the trail leads the keeper's feet, px on the meadow. Absent when the step is not on the meadow. */
  stand?: Point;
  /** Where the marker floats, px on the meadow. */
  mark?: Point;
}

/** A new Keeper comes in from the west end of the road and stops here. */
export const EDGE_X = 8;
export const ARRIVE_X = 4 * TILE + 8;
export const ARRIVE_Y = 21 * TILE;
/** How near the camp spot counts as having reached the fire, px. */
const CAMP_REACH = 30;

const NELL_X = footX(NELL_COL);
const NELL_Y = footY(NELL_ROW);
const CAVE_X = footX(CAVE_COL);
const CAVE_Y = footY(CAVE_ROW);

export const STEPS: readonly Step[] = [
  { id: "road", text: "questRoad", stand: { x: START_X, y: START_Y }, mark: { x: footX(FIRE_COL), y: footY(FIRE_ROW) - 34 } },
  { id: "chop", text: "questBirch", stand: { x: TREE_X, y: TREE_Y + 10 }, mark: { x: TREE_X, y: TREE_Y - 54 } },
  { id: "nell", text: "questNell", stand: { x: NELL_X, y: NELL_Y + 12 }, mark: { x: NELL_X, y: NELL_Y - 24 } },
  { id: "cellar", text: "questCellar", stand: { x: CAVE_X, y: CAVE_Y + 8 }, mark: { x: CAVE_X, y: CAVE_Y - 46 } },
  { id: "fight", text: "questFight" },
];

function done(step: Step, event: QuestEvent): boolean {
  switch (step.id) {
    case "road":
      return event.kind === "at" && Math.hypot(event.x - START_X, event.y - START_Y) <= CAMP_REACH;
    case "chop":
      return event.kind === "chopped";
    case "nell":
      return event.kind === "talked";
    case "cellar":
      return event.kind === "entered";
    case "fight":
      return event.kind === "cleared";
  }
}

/** The step after `event`: the same one unless the event is what that step was waiting for. */
export function advance(step: number, event: QuestEvent): number {
  const now = STEPS[step];
  if (!now) return step;
  return done(now, event) ? step + 1 : step;
}
