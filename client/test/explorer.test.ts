import { describe, expect, it } from "vitest";
import { explorerUrl, rollupEndpoint } from "../src/chain/explorer";
import { formatHundredths } from "../src/chain/format";

describe("explorer links", () => {
  it("never puts a rollup token in a shareable link", () => {
    const endpoint = rollupEndpoint("https://devnet-tee.magicblock.app", "abc def");
    expect(new URL(endpoint).searchParams.get("token")).toBe("abc def");
    // The private rollup's URL is a bearer credential, so a rollup receipt has no public link.
    expect(explorerUrl("sig123", "rollup", endpoint)).toBe("");
  });

  it("links a base transaction to devnet", () => {
    expect(explorerUrl("sig123", "base", "")).toBe("https://explorer.solana.com/tx/sig123?cluster=devnet");
  });
});

describe("glints", () => {
  it("prints hundredths as glints", () => {
    expect(formatHundredths(500n)).toBe("5.00");
    expect(formatHundredths(100n)).toBe("1.00");
    expect(formatHundredths(0n)).toBe("0.00");
  });
});
