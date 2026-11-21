// Turns the layout into things to draw: the birchwood, the hand-placed sites, the
// loose rocks and trees in the open fields, the ground scatter and the solid grid.
import { KINDS, type KindName } from "./cuts";
import { COLS, ROWS, TILE, chance, groundAt, isOpenSnow, onMap } from "./layout";
import { thawLevel, type Light } from "./lights";
import { footX, footY, lights, sites, NELL_COL, NELL_ROW } from "./sites";
import { Solid } from "./solid";

export interface Prop {
  kind: KindName;
  x: number;
  y: number;
}

/** A flat mark on the ground: a frame of TilesetFloorDetail.png. */
export interface Decal {
  x: number;
  y: number;
  frame: number;
}

export interface Meadow {
  props: Prop[];
  decals: Decal[];
  lights: Light[];
  solid: Solid;
}

const WOOD: KindName[] = ["snowRound", "snowRound", "snowPine", "snowRound", "snowPine", "dead"];
const LONE_TREES: KindName[] = ["snowRound", "snowPine", "snowRound", "dead"];
const ROCKS: KindName[] = ["rockCap", "snowball", "tealRock", "peaks", "snowPile", "shards", "snowRock", "snowLump"];
const DEADWOOD: KindName[] = ["deadBush", "stumpSmall", "log"];
/** TilesetFloorDetail.png, 16 frames a row: row 3 is the frosted scatter, row 2 the green. */
const FROST_DECALS = [48, 49, 50, 51, 52, 54, 55, 5, 6, 7, 16, 10];
const THAW_DECALS = [32, 33, 34, 35, 36, 37, 38, 39];
const ROAD_DECALS = [5, 6, 7, 4];

let built: Meadow | undefined;

export function meadow(): Meadow {
  if (built) return built;
  const glow = lights();
  const taken = new Set<number>();
  const props: Prop[] = [];
  placeSites(props, taken);
  fillWood(props);
  scatterFields(props, taken, glow);
  const solid = new Solid();
  markGround(solid);
  for (const prop of props) markProp(solid, prop);
  markFoot(solid, footX(NELL_COL), footY(NELL_ROW), 5, 6);
  built = { props, decals: scatterDecals(taken, glow), lights: glow, solid };
  return built;
}

function key(col: number, row: number): number {
  return col + row * COLS;
}

function pick<T>(list: readonly T[], roll: number): T {
  return list[Math.min(list.length - 1, Math.floor(roll * list.length))];
}

/** Hand-placed sites, and the tiles each one covers so nothing else lands on them. */
function placeSites(props: Prop[], taken: Set<number>): void {
  for (const { kind, col, row } of sites()) {
    props.push({ kind, x: footX(col), y: footY(row) });
    const half = KINDS[kind].w / 2 / TILE;
    const tall = Math.ceil(KINDS[kind].h / TILE);
    for (let r = row - tall; r <= row + 1; r += 1) {
      for (let c = Math.floor(col - half - 0.5); c <= Math.ceil(col + half + 0.5); c += 1) taken.add(key(c, r));
    }
  }
  for (let r = NELL_ROW - 1; r <= NELL_ROW + 1; r += 1) {
    for (let c = NELL_COL - 1; c <= NELL_COL + 1; c += 1) taken.add(key(c, r));
  }
}

/** How far a wood tree's foot sits below its tile, so its canopy only laps 8 px over the tile to the north. */
const WOOD_DROP = TILE / 2;

/** The birchwood: a staggered stand, one trunk on every other tile, so canopies overlap like a hedge. */
function fillWood(props: Prop[]): void {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (groundAt(col, row) !== "#" || (col + row) % 2 !== 0) continue;
      const patch = chance(Math.floor(col / 6), Math.floor(row / 5), 3);
      const kind = pick(WOOD, (patch * 0.6 + chance(col, row, 5) * 0.4) % 1);
      props.push({ kind, x: footX(col), y: footY(row) + WOOD_DROP });
    }
  }
}

function clearAround(col: number, row: number, taken: Set<number>): boolean {
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (!onMap(c, r) || taken.has(key(c, r))) return false;
      const ground = groundAt(c, r);
      if (ground === "=" || ground === "," || ground === "~") return false;
    }
  }
  return true;
}

/** Lone trees, rocks and deadwood in the open snow, never beside the road or each other. */
function scatterFields(props: Prop[], taken: Set<number>, glow: readonly Light[]): void {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (!isOpenSnow(col, row) || !clearAround(col, row, taken)) continue;
      const roll = chance(col, row, 31);
      const kind = looseKind(roll, chance(col, row, 37));
      if (!kind) continue;
      const warm = thawLevel(footX(col), footY(row) - 4, glow) >= 0.5;
      props.push({ kind: warm && kind.startsWith("snow") ? "frostGreen" : kind, x: footX(col), y: footY(row) - 2 });
      taken.add(key(col, row));
    }
  }
}

function looseKind(roll: number, which: number): KindName | undefined {
  if (roll < 0.05) return pick(LONE_TREES, which);
  if (roll < 0.09) return pick(ROCKS, which);
  if (roll < 0.11) return pick(DEADWOOD, which);
  return undefined;
}

/** Tufts, twigs and pebbles on walkable ground; green ones where a lantern has thawed it. */
function scatterDecals(taken: Set<number>, glow: readonly Light[]): Decal[] {
  const decals: Decal[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ground = groundAt(col, row);
      if (ground === "#" || ground === "~" || taken.has(key(col, row))) continue;
      const warm = thawLevel(footX(col), footY(row) - 8, glow) >= 0.75;
      const roll = chance(col, row, 41);
      const share = ground === "=" ? 0.05 : warm ? 0.3 : 0.16;
      if (roll >= share) continue;
      const frames = ground === "=" ? ROAD_DECALS : warm ? THAW_DECALS : FROST_DECALS;
      const dx = Math.floor(chance(col, row, 43) * 7) - 3;
      const dy = Math.floor(chance(col, row, 47) * 7) - 3;
      decals.push({ x: footX(col) + dx, y: footY(row) - 8 + dy, frame: pick(frames, roll / share) });
    }
  }
  return decals;
}

function markGround(solid: Solid): void {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ground = groundAt(col, row);
      if (ground !== "#" && ground !== "~") continue;
      const drop = ground === "#" && groundAt(col, row + 1) !== "#" ? WOOD_DROP : 0;
      solid.fill(col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE + drop);
    }
  }
}

function markProp(solid: Solid, prop: Prop): void {
  const footprint = KINDS[prop.kind].solid;
  if (footprint) markFoot(solid, prop.x, prop.y, footprint[0], footprint[1]);
}

function markFoot(solid: Solid, x: number, y: number, half: number, up: number): void {
  solid.fill(x - half, y - up, x + half, y);
}
