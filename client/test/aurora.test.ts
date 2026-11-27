import { describe, expect, it } from "vitest";
import { auroraAt } from "../src/shared/aurora";

describe("the aurora clock", () => {
  it("is up for the first ten minutes of every half hour", () => {
    expect(auroraAt(0)).toEqual({ up: true, left: 600, oneIn: 120 });
    expect(auroraAt(599)).toEqual({ up: true, left: 1, oneIn: 120 });
    expect(auroraAt(600)).toEqual({ up: false, left: 1200, oneIn: 400 });
    expect(auroraAt(1799)).toEqual({ up: false, left: 1, oneIn: 400 });
    expect(auroraAt(1800 * 7 + 30).up).toBe(true);
  });
});
