// The hand-placed things: the camp, the cottage, the igloos, the cave and the lamps.
// A site names a tile; the sprite's foot sits on the bottom edge of that tile, centred
// on it (use a half column to centre a wide sprite between two tiles).
import { GATHER_TILES } from "../../gen/economy";
import type { KindName } from "./cuts";
import { BIRCH_COL, BIRCH_ROW, TILE } from "./layout";
import type { Light } from "./lights";

export interface Site {
  kind: KindName;
  col: number;
  row: number;
}

function site(kind: KindName, col: number, row: number): Site {
  return { kind, col, row };
}

export const FIRE_COL = 24.5;
export const FIRE_ROW = 17;
export const NELL_COL = 22;
export const NELL_ROW = 17;
export const CAVE_COL = 52.5;
export const CAVE_ROW = 18;
export const [ROCK_COL, ROCK_ROW] = GATHER_TILES[1];
export const [COAL_COL, COAL_ROW] = GATHER_TILES[2];
export const [ORE_COL, ORE_ROW] = GATHER_TILES[3];
export const [BERRY_COL, BERRY_ROW] = GATHER_TILES[4];

const CAMP: Site[] = [
  site("birch", BIRCH_COL, BIRCH_ROW),
  site("bush", BERRY_COL, BERRY_ROW),
  site("rockCap", ROCK_COL, ROCK_ROW),
  site("firepit", FIRE_COL, FIRE_ROW),
  site("tent", 28, 15),
  site("birchLogs", 20.5, 15),
  site("stump", 25.5, 14),
  site("stumpSmall", 21, 14),
  site("bench", 25.5, 19),
  site("chest", 26, 16),
  site("barrel", 30, 16),
  site("sack", 30, 15),
];

const COTTAGE: Site[] = [
  site("cottage", 34.5, 7),
  site("darkLogs", 37.5, 7),
  site("barrel", 32, 7),
  site("hay", 38, 9),
  site("table", 31, 9),
  site("stool", 32, 9),
];

const IGLOOS: Site[] = [
  site("igloo", 20, 31),
  site("iglooSmall", 27.5, 31),
  site("crate", 29.5, 33),
  site("snowLump", 18, 32),
  site("snowLump", 26, 34),
  site("stool", 21, 33),
];

const CAVE: Site[] = [
  site("cave", CAVE_COL, CAVE_ROW),
  site("tealRock", COAL_COL, COAL_ROW),
  site("shards", ORE_COL, ORE_ROW),
  site("darkLogs", 50, 17),
  site("barrel", 55, 19),
];

const POND: Site[] = [
  site("snowBoulder", 4.5, 6),
  site("rockCap", 16, 7),
  site("peaks", 5, 10),
  site("deadBush", 16, 11),
  site("tealBoulder", 16.5, 9),
  site("dead", 4, 11),
];

const FIELDS: Site[] = [
  site("whiteGrove", 40.5, 23),
  site("pineGrove", 47.5, 13),
  site("frostGrove", 9.5, 23),
  site("pineGrove", 28.5, 27),
  site("whiteGrove", 40, 4),
  site("snowBoulder", 45.5, 22),
  site("tealBoulder", 30.5, 23),
  site("stump", 18.5, 23),
  site("log", 20, 24),
];

/** Lamp posts: [col,row] of the tile each one stands on. */
export const LAMPS: Array<readonly [number, number]> = [
  [20, 18],
  [29, 18],
  [6, 19],
  [13, 22],
  [33, 19],
  [44, 19],
  [36, 14],
  [32, 10],
  [22, 26],
  [22, 33],
  [49, 19],
];

export function sites(): Site[] {
  const lamps = LAMPS.map(([col, row]) => site("lamp", col, row));
  return [...CAMP, ...COTTAGE, ...IGLOOS, ...CAVE, ...POND, ...FIELDS, ...lamps];
}

export function footX(col: number): number {
  return col * TILE + TILE / 2;
}

export function footY(row: number): number {
  return (row + 1) * TILE;
}

const LAMP_GLOW = 46;
const LAMP_THAW = 40;
const FIRE_GLOW = 76;
const FIRE_THAW = 62;
const BIRCH_GLOW = 40;

/** Every fixed light on the map: one per lamp post and one for the camp fire. */
export function lights(): Light[] {
  const posts = LAMPS.map(([col, row]) => ({ x: footX(col) + 3, y: footY(row) - 10, radius: LAMP_GLOW, thaw: LAMP_THAW }));
  const fire = { x: footX(FIRE_COL), y: footY(FIRE_ROW) - 12, radius: FIRE_GLOW, thaw: FIRE_THAW };
  // The birch is white on white snow: a pool of light on its crown makes it the thing to walk to.
  const birch = { x: footX(BIRCH_COL), y: footY(BIRCH_ROW) - 28, radius: BIRCH_GLOW, thaw: 0 };
  return [fire, birch, ...posts];
}
