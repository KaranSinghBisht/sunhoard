import { describe, expect, it } from "vitest";
import { sha256 } from "../src/shared/sha";
import type { SlotView } from "../src/ui/pack";
import { chainStrips, dustStrip, gradeStrip, hitIndex, landAt, percent, restIn, rollText, stripsFor, waitingStrip, widths } from "../src/ui/roll/strip";
import { DUST_PPM, GRADE_PPM, PAIR_PPM_LARGE, PPM, ppmOf, rollShell } from "../src/ui/roll/thawOdds";
import { settleThaw, shortHex } from "../src/ui/roll/thawResult";
import { FORGING, hitSweep, restAngle, scrapBack, sliceUnder, stopTurn, strikeEnd } from "../src/ui/roll/wheel";

/** The same helper as the program's own tests in logic/seal.rs. */
function keyWords(words: number[]): Uint8Array {
  const key = new Uint8Array(32);
  const view = new DataView(key.buffer);
  words.forEach((word, index) => view.setUint32(index * 4, word, true));
  return key;
}

function block(slot: number, gem: { tone: number; grade: number; purityBp: number; pattern: number }): SlotView {
  return { slot, id: String(100 + slot), kind: 0, quantity: 1, rarity: 0, traits: [], shell: 0, flags: 4, ...gem };
}

describe("the thaw tables mirror the program", () => {
  it("every grade table and every strip adds up to a whole", () => {
    for (const table of GRADE_PPM) expect(table.reduce((sum, ppm) => sum + ppm, 0)).toBe(PPM);
    for (let shell = 0; shell < 5; shell += 1) {
      expect(dustStrip(shell, null).segments.reduce((sum, segment) => sum + segment.ppm, 0)).toBe(PPM);
      expect(gradeStrip(shell, null).segments.reduce((sum, segment) => sum + segment.ppm, 0)).toBe(PPM);
    }
    expect(DUST_PPM).toEqual([700_000, 500_000, 250_000, 0, 0]);
    expect(PAIR_PPM_LARGE).toBe(150_000);
  });

  it("reads parts per million as roll.rs does", () => {
    expect(ppmOf(0)).toBe(0);
    expect(ppmOf(0xffffffff)).toBeLessThan(PPM);
    expect(ppmOf(3_006_477_108)).toBe(700_000);
    expect(ppmOf(3_006_477_107)).toBe(699_999);
  });

  it("opens the keys of seal.rs's own tests the same way", () => {
    const zero = new Uint8Array(32);
    expect(rollShell(zero, 0)).toMatchObject({ dust: 200, gems: [], dustRoll: 0 });
    const crater = rollShell(zero, 3);
    expect(crater?.gems).toHaveLength(2);
    expect(crater?.gems[0]).toMatchObject({ tone: 0, grade: 1, purityBp: 0, pattern: 0 });

    const words = [3_006_477_108, 0, 0xffffffff, 0xffffffff, 0, 0, 644_245_095, 0];
    const small = rollShell(keyWords(words), 0);
    expect(small).toMatchObject({ dust: 0, dustRoll: 700_000, pairRoll: null });
    expect(small?.gems).toHaveLength(1);
    expect(small?.gems[0]).toMatchObject({ grade: 0, purityBp: 10_000 });
    expect(rollShell(keyWords(words), 2)?.gems).toHaveLength(1);
    words[6] = 0;
    expect(rollShell(keyWords(words), 2)?.gems).toHaveLength(2);
    expect(rollShell(zero, 9)).toBeNull();
  });
});

describe("odds strips", () => {
  it("labels each chance as the table has it", () => {
    expect(percent(700_000)).toBe("70%");
    expect(percent(9_000)).toBe("0.9%");
    expect(percent(1_000)).toBe("0.1%");
    expect(percent(666_600)).toBe("66.66%");
    expect(rollText(712_345)).toBe("712,345");
  });

  it("drops grades a shell can never hold and keeps thin ones visible", () => {
    expect(gradeStrip(3, null).segments.map((segment) => segment.id)).toEqual(["g1", "g2", "g3", "g4"]);
    const drawn = widths(gradeStrip(0, null).segments);
    expect(drawn.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100);
    expect(Math.min(...drawn)).toBeGreaterThan(4);
  });

  it("stops the marker inside the segment the roll fell in, at every boundary", () => {
    const { segments } = gradeStrip(0, null);
    const drawn = widths(segments);
    for (const roll of [0, 699_999, 700_000, 919_999, 920_000, 989_999, 990_000, 998_999, 999_000, 999_999]) {
      const index = hitIndex(segments, roll);
      const left = drawn.slice(0, index).reduce((sum, width) => sum + width, 0);
      const at = landAt(segments, roll);
      expect(at).toBeGreaterThanOrEqual(left);
      expect(at).toBeLessThanOrEqual(left + drawn[index]);
    }
    expect(hitIndex(segments, 699_999)).toBe(0);
    expect(hitIndex(segments, 700_000)).toBe(1);
    expect(hitIndex(segments, 999_000)).toBe(4);
  });

  it("shows the rolls the program made, in its order", () => {
    expect(stripsFor(rollShell(new Uint8Array(32), 0)!).map((strip) => strip.kind)).toEqual(["dust"]);
    expect(stripsFor(rollShell(new Uint8Array(32), 3)!).map((strip) => strip.kind)).toEqual(["gradeFirst", "gradeSecond"]);
    const pair = keyWords([0xffffffff, 0, 0, 0, 0, 0, 0, 0]);
    expect(stripsFor(rollShell(pair, 2)!).map((strip) => strip.kind)).toEqual(["dust", "gradeFirst", "pair", "gradeSecond"]);
    const single = keyWords([0xffffffff, 0, 0, 0, 0, 0, 0xffffffff, 0]);
    expect(stripsFor(rollShell(single, 2)!).map((strip) => strip.kind)).toEqual(["dust", "grade", "pair"]);
    expect(waitingStrip(0).kind).toBe("dust");
    expect(waitingStrip(3)).toMatchObject({ kind: "gradeFirst", roll: null });
  });
});

describe("strips from the outcome alone", () => {
  it("names the chain's outcome and quotes no roll", () => {
    const dust = chainStrips(0, []);
    expect(dust).toHaveLength(1);
    expect(dust[0]).toMatchObject({ kind: "dust", roll: null, truth: "dust" });
    expect(chainStrips(0, [2]).map((strip) => strip.truth)).toEqual(["block", "g2"]);
    expect(chainStrips(3, [4, 1]).map((strip) => [strip.kind, strip.truth])).toEqual([["gradeFirst", "g4"], ["gradeSecond", "g1"]]);
    expect(chainStrips(2, [0]).map((strip) => strip.truth)).toEqual(["block", "g0", "none"]);
    expect(chainStrips(2, [0, 3]).map((strip) => strip.truth)).toEqual(["block", "g0", "second", "g3"]);
  });

  it("rests the marker inside the true segment", () => {
    const { segments } = dustStrip(0, null);
    expect(restIn(segments, 0)).toBeCloseTo(21);
    expect(restIn(segments, 1)).toBeCloseTo(79);
  });
});

describe("a thaw's result is the chain's", () => {
  const key = keyWords([0xffffffff, 0x80000000, 5, 9, 77, 0xc0000000, 0, 0]);
  const seal = sha256(key);
  const rolled = rollShell(key, 3)!;
  const first = block(4, rolled.gems[0]);
  const second = block(9, rolled.gems[1]);

  it("orders the pack's new blocks as the key rolled them and proves the seal", () => {
    const result = settleThaw({ shell: 3, seal, receipt: null, slotKey: key, fresh: [second, first], shellGone: true });
    expect(result.kind).toBe("blocks");
    expect(result.blocks.map((entry) => entry.slot)).toEqual([4, 9]);
    expect(result.rolled).not.toBeNull();
    expect(result.sealOk).toBe(true);
    expect(shortHex(result.keyHash!)).toBe(shortHex(seal));
  });

  it("shows no rolls when the key does not reproduce what the chain wrote", () => {
    const other = block(4, { ...rolled.gems[0], grade: (rolled.gems[0].grade + 1) % 5 });
    const result = settleThaw({ shell: 3, seal, receipt: null, slotKey: key, fresh: [other, second], shellGone: true });
    expect(result.rolled).toBeNull();
    expect(result.blocks).toHaveLength(2);
  });

  it("never passes a seal it cannot check", () => {
    const wrong = settleThaw({ shell: 3, seal: new Uint8Array(32).fill(7), receipt: null, slotKey: key, fresh: [first, second], shellGone: true });
    expect(wrong.sealOk).toBe(false);
    const none = settleThaw({ shell: 0, seal, receipt: null, slotKey: null, fresh: [], shellGone: true });
    expect(none).toMatchObject({ kind: "dust", sealOk: false, keyHash: null, rolled: null, dust: null });
    const paid = settleThaw({ shell: 0, seal, receipt: null, slotKey: null, fresh: [], shellGone: true, purseGain: 200n });
    expect(paid.dust).toBe(200n);
  });

  it("reads dust and refunds from the receipt", () => {
    const zero = new Uint8Array(32);
    const dust = settleThaw({ shell: 0, seal: sha256(zero), receipt: { key: zero, dust: 200n, blocks: 0, refund: 0n }, slotKey: null, fresh: [], shellGone: true });
    expect(dust).toMatchObject({ kind: "dust", dust: 200n });
    expect(dust.rolled?.dustRoll).toBe(0);
    // sealMatches refuses an all-zero key, as the page always has.
    expect(dust.sealOk).toBe(false);
    const refund = settleThaw({ shell: 0, seal, receipt: { key: null, dust: 0n, blocks: 0, refund: 500n }, slotKey: null, fresh: [], shellGone: false });
    expect(refund).toMatchObject({ kind: "refund", rolled: null, sealOk: false });
  });
});

describe("the anvil's wheel", () => {
  it("sizes the hit slice to the odds", () => {
    expect(hitSweep(5_000)).toBe(180);
    expect(hitSweep(6_666)).toBeCloseTo(239.976);
    expect(hitSweep(8_000)).toBe(288);
  });

  it("always stops with the pointer in the true slice", () => {
    for (const odds of [3_000, 4_321, 6_666, 8_000]) {
      for (let step = 0; step <= 20; step += 1) {
        const unit = step / 20;
        expect(sliceUnder(odds, stopTurn(odds, true, unit))).toBe("hit");
        expect(sliceUnder(odds, stopTurn(odds, false, unit))).toBe("miss");
        expect(restAngle(odds, true, unit)).toBeLessThan(hitSweep(odds));
        expect(restAngle(odds, false, unit)).toBeGreaterThan(hitSweep(odds));
      }
    }
  });

  it("returns a tenth of the inputs as scrap", () => {
    expect(scrapBack(1_000n)).toBe(100n);
    expect(scrapBack(805n)).toBe(80n);
  });

  it("reads hit, miss and still forging from the pack", () => {
    const before = { slot: 3, id: "41", rarity: 0, flags: 0 };
    expect(strikeEnd(before, [{ ...before, flags: FORGING }])).toBe("pending");
    expect(strikeEnd(before, [{ ...before }])).toBe("pending");
    expect(strikeEnd(before, [{ ...before, rarity: 1 }])).toBe("hit");
    expect(strikeEnd(before, [])).toBe("miss");
    expect(strikeEnd(before, [{ ...before, id: "77" }])).toBe("miss");
  });
});
