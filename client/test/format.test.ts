import { describe, expect, it } from "vitest";
import { formatHundredths, parseGlints, playerMessage } from "../src/chain/format";

describe("typed Glints", () => {
  it("reads whole and two-place amounts into hundredths", () => {
    expect(parseGlints("2")).toBe(200n);
    expect(parseGlints(" 2.5 ")).toBe(250n);
    expect(parseGlints("0.07")).toBe(7n);
    expect(parseGlints("")).toBe(0n);
  });

  it("refuses anything that is not an amount", () => {
    for (const typed of ["-1", "1.234", "1e3", "abc", "1,5", ".5", "0x10", "12345678901"]) {
      expect(parseGlints(typed)).toBeNull();
    }
  });

  it("round-trips through the display format", () => {
    expect(formatHundredths(parseGlints("12.3") ?? 0n)).toBe("12.30");
  });
});

describe("player messages", () => {
  it("shows the program's own line", () => {
    const err = new Error("AnchorError occurred. Error Code: SunFree. Error Number: 6001. Error Message: Old Gloam has fallen. The sun is free.");
    expect(playerMessage(err)).toBe("Old Gloam has fallen.");
  });

  it("hides addresses and raw codes", () => {
    const err = new Error("failed to send FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS custom program error: 0x1771");
    expect(playerMessage(err)).not.toContain("FxqDh8g5");
  });
});
