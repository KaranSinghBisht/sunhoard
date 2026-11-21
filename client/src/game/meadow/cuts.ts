// Whole sprites measured off the pack sheets (each rectangle is trimmed to the
// sprite's own pixels, so its bottom edge is where it meets the ground).
export type SheetKey = "nature" | "camp" | "house" | "relief";

export interface Kind {
  sheet: SheetKey;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Solid footprint as [half width, height] in px up from the sprite's foot. */
  solid?: readonly [number, number];
}

function kind(sheet: SheetKey, x: number, y: number, w: number, h: number, solid?: readonly [number, number]): Kind {
  return { sheet, x, y, w, h, solid };
}

const TRUNK = [5, 7] as const;

export const KINDS = {
  snowRound: kind("nature", 192, 2, 32, 29, TRUNK),
  snowPine: kind("nature", 160, 0, 32, 32, TRUNK),
  frostGreen: kind("nature", 128, 0, 32, 32, TRUNK),
  dead: kind("nature", 64, 0, 32, 31, TRUNK),
  whiteGrove: kind("nature", 128, 32, 64, 47, [26, 12]),
  pineGrove: kind("nature", 128, 80, 64, 48, [26, 12]),
  frostGrove: kind("nature", 64, 80, 64, 48, [26, 12]),
  birch: kind("nature", 96, 288, 48, 48, [6, 8]),
  tealBoulder: kind("nature", 0, 194, 32, 30, [14, 14]),
  snowBoulder: kind("nature", 32, 194, 32, 30, [14, 14]),
  rockCap: kind("nature", 66, 193, 13, 14, [6, 7]),
  snowball: kind("nature", 80, 193, 16, 14, [7, 7]),
  shards: kind("nature", 97, 195, 14, 11, [6, 6]),
  tealRock: kind("nature", 114, 193, 13, 14, [6, 7]),
  peaks: kind("nature", 145, 194, 14, 11, [6, 6]),
  snowPile: kind("nature", 160, 194, 16, 11, [7, 6]),
  pebbles: kind("nature", 176, 194, 14, 13),
  frostTuft: kind("nature", 129, 212, 13, 9),
  frostSprig: kind("nature", 145, 213, 14, 6),
  snowLump: kind("nature", 160, 209, 16, 14, [7, 7]),
  stump: kind("nature", 1, 134, 30, 23, [12, 10]),
  stumpSmall: kind("nature", 64, 129, 16, 15, [6, 7]),
  log: kind("nature", 80, 131, 16, 13, [7, 6]),
  deadBush: kind("nature", 64, 145, 15, 15, [5, 6]),
  bush: kind("nature", 16, 161, 16, 14, [6, 6]),
  fern: kind("nature", 64, 178, 16, 14),
  daisy: kind("nature", 96, 178, 16, 14),
  lamp: kind("camp", 96, 82, 16, 29, [4, 5]),
  tent: kind("camp", 64, 3, 48, 45, [22, 24]),
  firepit: kind("camp", 192, 81, 32, 31, [13, 14]),
  darkLogs: kind("camp", 0, 1, 32, 15, [15, 8]),
  birchLogs: kind("camp", 32, 1, 32, 15, [15, 8]),
  bench: kind("camp", 2, 113, 44, 14, [21, 7]),
  crate: kind("camp", 64, 96, 32, 32, [15, 14]),
  spit: kind("camp", 129, 48, 30, 32, [13, 10]),
  table: kind("camp", 18, 82, 28, 28, [13, 12]),
  stool: kind("camp", 51, 85, 11, 11, [5, 6]),
  barrel: kind("camp", 64, 80, 16, 16, [7, 8]),
  sack: kind("camp", 81, 80, 15, 16, [6, 7]),
  chest: kind("camp", 65, 129, 14, 14, [6, 7]),
  hay: kind("camp", 0, 49, 47, 31, [22, 14]),
  cottage: kind("house", 304, 304, 48, 48, [23, 30]),
  igloo: kind("house", 0, 170, 48, 52, [22, 28]),
  iglooSmall: kind("house", 55, 176, 34, 46, [16, 26]),
  cave: kind("relief", 0, 112, 48, 40, [22, 26]),
  snowRock: kind("relief", 65, 19, 14, 10, [6, 6]),
} as const satisfies Record<string, Kind>;

export type KindName = keyof typeof KINDS;

export const SHEET_KEYS: readonly SheetKey[] = ["nature", "camp", "house", "relief"];
