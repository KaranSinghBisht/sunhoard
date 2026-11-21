// Finds the way on foot to a spot on the meadow, on the same half-tile grid the keeper collides with.
// Used to draw the trail of dots a new Keeper follows.
import { MAP_H, MAP_W, TILE, groundAt } from "./layout";
import type { Solid } from "./solid";

const CELL = 8;
const HALF = CELL / 2;
const COLS = MAP_W / CELL;
const ROWS = MAP_H / CELL;
const STRAIGHT = 10;
const DIAGONAL = 14;
/** Snow costs this many times a step on the road or trodden ground, so the trail keeps to the road where it can. */
const SNOW_DRAG = 3;
const UNREACHED = 0xffff;
/** How many cells around a point are searched for somewhere to stand. */
const SNAP = 4;
const TURNS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export interface Point {
  x: number;
  y: number;
}

export interface Route {
  /** 1 where the keeper can stand, one entry per half-tile. */
  open: Uint8Array;
  /** Walking cost from each half-tile to the goal: 10 a straight step on the road, 14 a diagonal one, three times that on snow. */
  cost: Uint16Array;
}

function pointOf(node: number): Point {
  return { x: (node % COLS) * CELL + HALF, y: Math.floor(node / COLS) * CELL + HALF };
}

function openNodes(solid: Solid): Uint8Array {
  const open = new Uint8Array(COLS * ROWS);
  for (let node = 0; node < open.length; node += 1) {
    const { x, y } = pointOf(node);
    open[node] = solid.blocks(x, y) ? 0 : 1;
  }
  return open;
}

/** How hard the ground under a half-tile is to walk, as a multiple of a road step. */
function drag(node: number): number {
  const { x, y } = pointOf(node);
  const ground = groundAt(Math.floor(x / TILE), Math.floor(y / TILE));
  return ground === "=" || ground === "," ? 1 : SNOW_DRAG;
}

function isOpen(open: Uint8Array, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < COLS && row < ROWS && open[col + row * COLS] === 1;
}

/** The open half-tile nearest (x,y), or -1 when there is none within a few cells. */
function nearest(open: Uint8Array, x: number, y: number): number {
  const col = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);
  let best = -1;
  let bestGap = Infinity;
  for (let dr = -SNAP; dr <= SNAP; dr += 1) {
    for (let dc = -SNAP; dc <= SNAP; dc += 1) {
      if (!isOpen(open, col + dc, row + dr)) continue;
      const node = col + dc + (row + dr) * COLS;
      const at = pointOf(node);
      const gap = Math.hypot(at.x - x, at.y - y);
      if (gap < bestGap) {
        best = node;
        bestGap = gap;
      }
    }
  }
  return best;
}

/** Where one step from `node` can land. A diagonal step needs both straight steps beside it open, so no corner is cut. */
function steps(open: Uint8Array, node: number): Array<readonly [node: number, cost: number]> {
  const col = node % COLS;
  const row = Math.floor(node / COLS);
  const out: Array<readonly [number, number]> = [];
  for (const [dc, dr] of TURNS) {
    if (!isOpen(open, col + dc, row + dr)) continue;
    const diagonal = dc !== 0 && dr !== 0;
    if (diagonal && !(isOpen(open, col + dc, row) && isOpen(open, col, row + dr))) continue;
    const next = col + dc + (row + dr) * COLS;
    out.push([next, (diagonal ? DIAGONAL : STRAIGHT) * drag(next)]);
  }
  return out;
}

/** The walking cost from everywhere on the meadow to the open half-tile nearest (x,y). */
export function routeTo(solid: Solid, x: number, y: number): Route {
  const open = openNodes(solid);
  const cost = new Uint16Array(open.length).fill(UNREACHED);
  const goal = nearest(open, x, y);
  if (goal < 0) return { open, cost };
  cost[goal] = 0;
  const buckets: number[][] = [[goal]];
  for (let now = 0; now < buckets.length; now += 1) {
    for (const node of buckets[now] ?? []) {
      if (cost[node] === now) spread(open, cost, buckets, node);
    }
  }
  return { open, cost };
}

function spread(open: Uint8Array, cost: Uint16Array, buckets: number[][], node: number): void {
  for (const [next, price] of steps(open, node)) {
    const total = cost[node] + price;
    if (total >= cost[next]) continue;
    cost[next] = total;
    (buckets[total] ??= []).push(next);
  }
}

/** True when the goal can be walked to from (x,y). */
export function reaches(route: Route, x: number, y: number): boolean {
  const from = nearest(route.open, x, y);
  return from >= 0 && route.cost[from] !== UNREACHED;
}

/** Up to `count` points along the way from (x,y) to the goal, one every `gap` px, nearest first. */
export function trail(route: Route, x: number, y: number, count: number, gap: number): Point[] {
  const points: Point[] = [];
  let node = nearest(route.open, x, y);
  let since = 0;
  while (node >= 0 && points.length < count && route.cost[node] !== UNREACHED && route.cost[node] > 0) {
    let next = -1;
    for (const [step] of steps(route.open, node)) {
      if (route.cost[step] < route.cost[next < 0 ? node : next]) next = step;
    }
    if (next < 0) break;
    since += next % COLS !== node % COLS && Math.floor(next / COLS) !== Math.floor(node / COLS) ? CELL * Math.SQRT2 : CELL;
    node = next;
    if (since >= gap) {
      since = 0;
      points.push(pointOf(node));
    }
  }
  return points;
}
