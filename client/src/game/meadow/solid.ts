// Where the keeper cannot walk, kept on a half-tile (8 px) grid.
import { MAP_H, MAP_W } from "./layout";

const CELL = 8;
const FOOT_HALF = 4;
const FOOT_UP = 5;

export class Solid {
  private readonly cols = Math.ceil(MAP_W / CELL);
  private readonly rows = Math.ceil(MAP_H / CELL);
  private readonly cells = new Uint8Array(this.cols * this.rows);

  /** Marks every half-tile whose centre lies inside the rectangle (px, right and bottom exclusive). */
  fill(left: number, top: number, right: number, bottom: number): void {
    const firstCol = Math.max(0, Math.ceil((left - CELL / 2) / CELL));
    const lastCol = Math.min(this.cols - 1, Math.ceil((right - CELL / 2) / CELL) - 1);
    const firstRow = Math.max(0, Math.ceil((top - CELL / 2) / CELL));
    const lastRow = Math.min(this.rows - 1, Math.ceil((bottom - CELL / 2) / CELL) - 1);
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let col = firstCol; col <= lastCol; col += 1) this.cells[col + row * this.cols] = 1;
    }
  }

  at(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
    return this.cells[Math.floor(x / CELL) + Math.floor(y / CELL) * this.cols] === 1;
  }

  /** True when the keeper's feet, standing at (x,y), would overlap something solid. */
  blocks(x: number, y: number): boolean {
    const left = x - FOOT_HALF;
    const right = x + FOOT_HALF;
    const top = y - FOOT_UP;
    return this.at(left, top) || this.at(right, top) || this.at(left, y) || this.at(right, y);
  }
}
