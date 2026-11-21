import { type Fight } from "./fight";

export const HALF_TILE = 8;

export function positionError(left: Fight, right: Fight): number {
  let worst = gap(left.player.x, left.player.y, right.player.x, right.player.y);
  const count = Math.min(left.foes.length, right.foes.length);
  for (let index = 0; index < count; index += 1) {
    const a = left.foes[index].body;
    const b = right.foes[index].body;
    worst = Math.max(worst, gap(a.x, a.y, b.x, b.y));
  }
  return worst;
}

export function insideHalfTile(error: number): boolean {
  return error < HALF_TILE;
}

function gap(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
