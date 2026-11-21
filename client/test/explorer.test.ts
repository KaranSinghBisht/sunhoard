import { describe, expect, it } from "vitest";
import { explorerUrl, rollupEndpoint } from "../src/chain/explorer";
import { formatHundredths } from "../src/chain/format";

describe("explorer links", () => {
  it("encodes the whole rollup url, token included", () => {
    const endpoint = rollupEndpoint("https://devnet-tee.magicblock.app", "abc def");
    const url = explorerUrl("sig123", "rollup", endpoint);
    expect(url).toContain("cluster=custom");
    expect(url).toContain(encodeURIComponent(endpoint));
    expect(url).not.toContain("?token=");
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
