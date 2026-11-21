import { describe, expect, it } from "vitest";
import { PIECE_COUNT, blobMask, blobPiece } from "../src/game/meadow/autotile";
import { KINDS } from "../src/game/meadow/cuts";
import { COLS, MAP_H, MAP_W, ROWS, START_X, START_Y, TILE, groundAt, rowsText } from "../src/game/meadow/layout";
import { meadow } from "../src/game/meadow/props";
import { LAMPS, sites } from "../src/game/meadow/sites";
import { USES, useAt } from "../src/game/meadow/uses";

const STEP = 4;

/** Every spot the keeper can walk to from the start, on a 4-px lattice. */
function reachable(): Set<string> {
  const { solid } = meadow();
  const seen = new Set<string>([`${START_X},${START_Y}`]);
  const queue: Array<[number, number]> = [[START_X, START_Y]];
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head];
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const next: [number, number] = [x + dx, y + dy];
      const key = `${next[0]},${next[1]}`;
      if (seen.has(key) || solid.blocks(next[0], next[1])) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen;
}

function spots(walked: Set<string>): Array<[number, number]> {
  return [...walked].map((key) => key.split(",").map(Number) as [number, number]);
}

describe("the terrain pieces", () => {
  it("has one piece for each of the 47 blob shapes", () => {
    expect(PIECE_COUNT).toBe(47);
    const cells = new Set<string>();
    for (let bits = 0; bits < 256; bits += 1) {
      const land = (col: number, row: number) => {
        if (col === 0 && row === 0) return true;
        const index = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]].findIndex(
          ([dc, dr]) => dc === col && dr === row,
        );
        return index >= 0 && (bits & (1 << index)) === 0;
      };
      cells.add(blobPiece(blobMask(land, 0, 0)).join(","));
    }
    expect(cells.size).toBe(47);
  });
});

describe("the meadow map", () => {
  it("is a full rectangle of known ground", () => {
    expect(rowsText().every((row) => row.length === COLS)).toBe(true);
    expect(rowsText().join("")).toMatch(/^[#.=,~]+$/);
    expect(MAP_W).toBe(COLS * TILE);
    expect(MAP_H).toBe(ROWS * TILE);
  });

  it("puts nothing by hand inside the birchwood or on the pond", () => {
    const misplaced = sites()
      .filter((site) => "#~".includes(groundAt(Math.floor(site.col), site.row)))
      .map((site) => `${site.kind}@${site.col},${site.row}`);
    expect(misplaced).toEqual([]);
    const lamps = LAMPS.filter(([col, row]) => "#~".includes(groundAt(col, row)));
    expect(lamps).toEqual([]);
  });

  it("cuts every sprite from inside a sheet tile grid", () => {
    for (const [name, cut] of Object.entries(KINDS)) {
      expect(cut.w, name).toBeGreaterThan(0);
      expect(cut.h, name).toBeGreaterThan(0);
      expect(cut.x, name).toBeGreaterThanOrEqual(0);
      expect(cut.y, name).toBeGreaterThanOrEqual(0);
    }
  });

  it("lets the keeper walk from the start to the birch, the cave and Nell", () => {
    const walked = spots(reachable());
    for (const use of USES) {
      const near = walked.some(([x, y]) => useAt(x, y)?.act === use.act);
      expect(near, use.act).toBe(true);
    }
  });

  it("lets the keeper walk the whole road and reach every clearing", () => {
    const walked = reachable();
    const blocked: string[] = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (groundAt(col, row) !== "=") continue;
        const x = col * TILE + 8;
        const y = row * TILE + 8;
        const near = [0, 4, -4, 8, -8].some((dx) => [0, 4, -4, 8, -8].some((dy) => walked.has(`${x + dx},${y + dy}`)));
        if (!near) blocked.push(`${col},${row}`);
      }
    }
    expect(blocked).toEqual([]);
  });

  it("keeps the start clear and the map edge closed", () => {
    const { solid } = meadow();
    expect(solid.blocks(START_X, START_Y)).toBe(false);
    expect(solid.blocks(-4, START_Y)).toBe(true);
    expect(solid.blocks(MAP_W + 4, START_Y)).toBe(true);
  });
});
