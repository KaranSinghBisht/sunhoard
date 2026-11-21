// The Bramble Cellars room, in Kenney Tiny Dungeon tiles (12 frames a row).
// The fight runs in a 256×256 box; the walls are a ring of tiles drawn around it.
export const TILE = 16;
export const ROOM = 256;
export const WALL = TILE;
/** Top-left of the fight box on the scene, px. */
export const ORIGIN_X = 112;
export const ORIGIN_Y = WALL;
export const WORLD_W = 480;
export const WORLD_H = ROOM + WALL * 2;

const EARTH = 0;
const EARTH_MARKS = [12, 24];
const BRICK = [40, 57, 58, 59];
const GRATE = 28;
const SCONCE = 29;
const TILES_ACROSS = ROOM / TILE;

export interface RoomTile {
  x: number;
  y: number;
  frame: number;
}

function roll(col: number, row: number): number {
  const mixed = Math.imul(col * 73856093 ^ row * 19349663, 2654435761) >>> 0;
  return mixed / 4294967296;
}

function wallFrame(col: number, row: number): number {
  if (row === -1 && (col === 3 || col === 12)) return SCONCE;
  if (row === -1 && (col === 7 || col === 8)) return GRATE;
  return BRICK[Math.floor(roll(col, row) * BRICK.length)];
}

function floorFrame(col: number, row: number): number {
  const chance = roll(col, row);
  return chance < 0.05 ? EARTH_MARKS[chance < 0.025 ? 0 : 1] : EARTH;
}

/** Every tile of the room: an earth floor inside a one-tile brick wall. */
export function roomTiles(): RoomTile[] {
  const tiles: RoomTile[] = [];
  for (let row = -1; row <= TILES_ACROSS; row += 1) {
    for (let col = -1; col <= TILES_ACROSS; col += 1) {
      const wall = row < 0 || col < 0 || row === TILES_ACROSS || col === TILES_ACROSS;
      const frame = wall ? wallFrame(col, row) : floorFrame(col, row);
      tiles.push({ x: ORIGIN_X + col * TILE + TILE / 2, y: ORIGIN_Y + row * TILE + TILE / 2, frame });
    }
  }
  return tiles;
}

/** Where the two wall sconces burn, px on the scene. */
export function sconces(): Array<{ x: number; y: number }> {
  return [3, 12].map((col) => ({ x: ORIGIN_X + col * TILE + TILE / 2, y: ORIGIN_Y - TILE / 2 }));
}

/** Sheet column for a fighter's facing (0 right, 1 down, 2 left, 3 up); sheets run down, up, left, right. */
export function sheetColumn(facing: number): number {
  return [3, 0, 2, 1][facing] ?? 0;
}
