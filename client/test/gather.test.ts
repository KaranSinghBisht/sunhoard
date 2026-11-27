import { beforeEach, describe, expect, it } from "vitest";
import { beginSwing, resetGather, rollLanded, swingFailed, swingLanded, tickGather, useGather } from "../src/game/gatherState";

describe("one gather at a time", () => {
  beforeEach(() => resetGather());

  it("holds a second chop back until the first is over", () => {
    expect(beginSwing(0)).toBe(true);
    expect(beginSwing(0)).toBe(false);
    swingLanded("+1 Wood", 1_000);
    expect(useGather.getState().phase).toBe("roll");
    expect(beginSwing(0)).toBe(false);
  });

  it("rests for the chain's cooldown after a quick roll, then frees Space", () => {
    beginSwing(0);
    swingLanded("+1 Wood", 1_000);
    rollLanded("No aberration this time.", false, 1_200);
    expect(useGather.getState().phase).toBe("rest");
    tickGather(4_000);
    expect(useGather.getState().phase).toBe("rest");
    tickGather(4_200);
    expect(beginSwing(0)).toBe(true);
  });

  it("frees Space at once when the roll lands after the cooldown", () => {
    beginSwing(1);
    swingLanded("+1 Stone", 1_000);
    rollLanded("Aberration! +20 Stone", true, 6_000);
    expect(useGather.getState().phase).toBe("idle");
    expect(useGather.getState().pop).toMatchObject({ node: 1, tone: "bonus" });
  });

  it("gives up on a roll that never arrives, and on a chop that fails", () => {
    beginSwing(0);
    swingFailed();
    expect(beginSwing(0)).toBe(true);
    swingLanded("+1 Wood", 1_000);
    tickGather(30_999);
    expect(useGather.getState().phase).toBe("roll");
    tickGather(31_000);
    expect(useGather.getState().phase).toBe("idle");
  });
});
