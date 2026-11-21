import { describe, expect, it } from "vitest";
import { inRange, nextPost, stepToward } from "../src/chain/pace";

describe("movement posts", () => {
  it("sends the first position as it stands", () => {
    expect(nextPost({ posted: false, x: 0, y: 0, at: 0 }, 40, 64, 5_000)).toEqual({ x: 40, y: 64 });
  });

  it("waits a second, then moves at most 80 units", () => {
    const pace = { posted: true, x: 0, y: 0, at: 1_000 };
    expect(nextPost(pace, 200, 0, 1_500)).toBeNull();
    expect(nextPost(pace, 200, 0, 2_000)).toEqual({ x: 80, y: 0 });
  });

  it("keeps a diagonal step inside the speed circle", () => {
    const step = stepToward(0, 0, 100, 100, 80);
    expect(step.x * step.x + step.y * step.y).toBeLessThanOrEqual(80 * 80);
  });

  it("keeps a chop inside the gather range", () => {
    expect(stepToward(0, 0, 3, 4, 80)).toEqual({ x: 3, y: 4 });
    expect(inRange(64, 80, 64, 80)).toBe(true);
    expect(inRange(0, 0, 64, 80)).toBe(false);
  });
});
