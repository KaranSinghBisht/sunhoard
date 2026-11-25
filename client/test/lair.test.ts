import { describe, expect, it } from "vitest";
import {
  GLOAMING,
  inLight,
  openLair,
  RIME_STEPS,
  scoopable,
  stepLair,
  VISIT_STEPS,
  type Lair,
  type LairIntent,
} from "../src/shared/lair";

const still: LairIntent = { dx: 0, dy: 0, attack: false, dash: false };
const stone = { material: 0, rarity: 0, keenPpm: 0, brutalBp: 0 };
const gildedLegend = { material: 2, rarity: 4, keenPpm: 0, brutalBp: 0 };

describe("the lair mirror", () => {
  it("phases advance and the visit ends", () => {
    const lair = openLair(new Uint8Array(32), false, stone);
    let done = false;
    for (let step = 0; step < VISIT_STEPS; step += 1) {
      done = stepLair(lair, still, 10_000).done;
      if (done) break;
    }
    expect(stepLair(lair, still, 10_000).done).toBe(true);
  });

  it("marked keepers hit harder", () => {
    const plain = openLair(new Uint8Array(32), false, stone);
    const marked = openLair(new Uint8Array(32), true, stone);
    const attack: LairIntent = { dx: 0, dy: 0, attack: true, dash: false };
    for (const lair of [plain, marked]) {
      lair.player.x = 128;
      lair.player.y = 112;
      lair.player.facing = 3;
    }
    const plainHit = stepLair(plain, attack, 10_000).damage;
    const markedHit = stepLair(marked, attack, 10_000).damage;
    expect(plainHit).toBeGreaterThan(0);
    expect(markedHit).toBe(Math.trunc((plainHit * 15_000) / 10_000));
  });

  it("lanterns guard the light", () => {
    expect(inLight(64, 64)).toBe(true);
    expect(inLight(128, 128)).toBe(false);
  });

  it("sparks spill on the tenth hit and can be scooped", () => {
    const lair = openLair(new Uint8Array(32), false, stone);
    lair.phaseStep = RIME_STEPS + 1; // Well into the Gloaming.
    lair.hits = 9;
    lair.player.x = 128;
    lair.player.y = 112;
    lair.player.facing = 3;
    const out = stepLair(lair, { dx: 0, dy: 0, attack: true, dash: false }, 20_000);
    expect(out.spilled).toBe(true);
    expect(scoopable(lair, 128, 112)).toBeGreaterThanOrEqual(0);
    expect(lair.phase).toBe(GLOAMING);
  });

  it("a gilded legendary blade deals its table damage", () => {
    const lair = openLair(new Uint8Array(32), false, gildedLegend);
    lair.player.x = 128;
    lair.player.y = 112;
    lair.player.facing = 3;
    const out = stepLair(lair, { dx: 0, dy: 0, attack: true, dash: false }, 10_000);
    // Gilded legendary base is 28; a crit is 42. Both are the chain's numbers.
    expect([28, 42]).toContain(out.damage);
  });
});

describe("the lair snapshot shape", () => {
  it("clones without sharing state", () => {
    const lair = openLair(new Uint8Array(32), false, stone);
    const copy = structuredClone(lair);
    copy.player.x = 5;
    expect(lair.player.x).toBe(128);
  });
});
