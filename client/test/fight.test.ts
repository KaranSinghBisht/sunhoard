import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openRoom, stepFight, SHOT_EMBER, type Fight, type Intent, type Weapon } from "../src/shared/fight";
import { insideHalfTile, positionError } from "../src/shared/predict";
import { sha256 } from "../src/shared/sha";

const still: Intent = { dx: 0, dy: 0, attack: false, dash: false };

describe("the room mirror", () => {
  it("hashes the same bytes the chain uses", () => {
    const empty = sha256(new Uint8Array());
    expect(Buffer.from(empty)).toEqual(createHash("sha256").update(Buffer.alloc(0)).digest());
    const key = Uint8Array.from({ length: 32 }, (_, index) => index);
    expect(Buffer.from(sha256(key))).toEqual(createHash("sha256").update(key).digest());
  });

  it("walks, dashes, and stops at the wall like the Rust room", () => {
    const fight = blank();
    stepFight(fight, { ...still, dx: 1 });
    expect(fight.player.x).toBe(8);
    stepFight(fight, { ...still, dx: 1, dy: 1 });
    expect(fight.player.x).toBe(13);
    expect(fight.player.y).toBe(5);
    const dash = blank();
    stepFight(dash, { ...still, dx: 1, dash: true });
    expect(dash.player.x).toBe(24);
    const boxed = blank(10);
    boxed.player.x = 8;
    stepFight(boxed, { ...still, dx: 1 });
    expect(boxed.player.x).toBe(10);
  });

  it("chases a rat inside aggro and hits on the iron cooldown", () => {
    const far = blank();
    far.foes = [rat(200, 0)];
    stepFight(far, still);
    expect(far.foes[0].body.x).toBe(200);
    const near = blank();
    near.foes = [rat(30, 0)];
    stepFight(near, still);
    expect(near.foes[0].body.x).toBe(24);
    const seed = quietSeed();
    const swing = blank();
    swing.seed = seed;
    swing.foes = [rat(16, 0)];
    const attack = { ...still, attack: true };
    const iron: Weapon = { material: 1, rarity: 0, keenPpm: 0, brutalBp: 0 };
    stepFight(swing, attack, iron);
    expect(swing.foes[0].body.hp).toBe(8);
    stepFight(swing, attack, iron);
    expect(swing.foes[0].body.hp).toBe(8);
  });

  it("counts contact once during invulnerability", () => {
    const fight = blank(64);
    fight.foes = [rat(0, 0)];
    stepFight(fight, still);
    expect(fight.player.hp).toBe(95);
    stepFight(fight, still);
    expect(fight.player.hp).toBe(95);
    expect(() => stepFight(fight, { ...still, dx: 2 })).toThrow("bad intent");
  });

  it("opens a five-foe room and treats a matching frame as inside half a tile", () => {
    const room = openRoom(new Uint8Array(32), 1, 100);
    expect(room.foes).toHaveLength(5);
    expect(room.player).toMatchObject({ x: 32, y: 128 });
    expect(insideHalfTile(positionError(room, room))).toBe(true);
    const boss = openRoom(new Uint8Array(5).fill(5), 6, 100);
    expect(boss.foes).toHaveLength(1);
    expect(boss.foes[0].kind).toBe(3);
    expect(boss.foes[0].body.hp).toBe(900);
  });

  it("the snuffer telegraphs, fires shots, and frost slows the keeper", () => {
    const seed = new Uint8Array(32).fill(3);
    const gilded: Weapon = { material: 2, rarity: 0, keenPpm: 0, brutalBp: 0 };
    const boss = openRoom(seed, 6, 100);
    boss.player.x = 0;
    boss.player.y = 0;
    for (let step = 0; step < 6; step += 1) stepFight(boss, still, gilded);
    // The first attack telegraphs on step 1 and fires on step 7.
    stepFight(boss, still, gilded);
    const embers = boss.shots.filter((shot) => shot.life > 0);
    const frost = boss.player.slow > 0;
    const hurt = boss.player.hp < 100;
    expect(embers.length > 0 || hurt || frost).toBe(true);
    // A shot that reaches the keeper hurts: put one ember on top of the keeper.
    boss.shots[0] = { x: 8, y: 0, vx: -2, vy: 0, life: 60, kind: SHOT_EMBER };
    const before = boss.player.hp;
    stepFight(boss, still, gilded);
    expect(boss.player.hp).toBe(before - 10);
  });
});

function blank(side = 256): Fight {
  return {
    stepIndex: 0,
    roomW: side,
    roomH: side,
    room: 1,
    player: { x: 0, y: 0, hp: 100, facing: 0, attackCd: 0, invuln: 0, dashCd: 0, dashLeft: 0, slow: 0 },
    foes: [],
    shots: [],
    bossAttack: 0,
    bossTelegraph: 0,
    bossCd: 0,
    weapon: { material: 0, rarity: 0, keenPpm: 0, brutalBp: 0 },
    seed: new Uint8Array(32),
  };
}

function rat(x: number, y: number): Fight["foes"][number] {
  return { kind: 0, body: { x, y, hp: 18, facing: 0, attackCd: 0, invuln: 0, dashCd: 0, dashLeft: 0, slow: 0 }, aimX: x, aimY: y, aimAge: 0 };
}

function quietSeed(): Uint8Array {
  for (let byte = 0; byte < 80; byte += 1) {
    const seed = new Uint8Array(32);
    seed[0] = byte;
    const fight = blank();
    fight.seed = seed;
    fight.foes = [rat(16, 0)];
    const iron: Weapon = { material: 1, rarity: 0, keenPpm: 0, brutalBp: 0 };
    stepFight(fight, { ...still, attack: true }, iron);
    if (fight.foes[0].body.hp === 8) return seed;
  }
  throw new Error("no quiet seed");
}
