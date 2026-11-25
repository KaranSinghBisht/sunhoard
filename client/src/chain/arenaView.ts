import type { Program } from "@coral-xyz/anchor";
import { type Fight, type Foe, type Fighter, type Shot, type Weapon } from "../shared/fight";
import { type Lair, type LairShot, type LairWeapon } from "../shared/lair";
import { asBytes, asNumber, field } from "./bytes";

const MODE_FIGHT = 2;
const MODE_LAIR = 3;

export function arenaPhase(program: Program, data: Buffer): {
  fight: Fight | null;
  lair: Lair | null;
  waiting: boolean;
} {
  const arena = decode(program, data);
  const mode = arena ? asNumber(field(arena, "mode")) : null;
  if (mode === MODE_FIGHT) {
    return { fight: fightFromDecoded(arena), lair: null, waiting: false };
  }
  if (mode === MODE_LAIR) {
    return { fight: null, lair: lairFromDecoded(arena), waiting: false };
  }
  return { fight: null, lair: null, waiting: mode === 1 };
}

export function fightFromAccount(program: Program, data: Buffer): Fight | null {
  return arenaPhase(program, data).fight;
}

function weaponOf(arena: Record<string, unknown>): Weapon {
  return {
    material: asNumber(field(arena, "weaponMaterial", "weapon_material")) ?? 0,
    rarity: asNumber(field(arena, "weaponRarity", "weapon_rarity")) ?? 0,
    keenPpm: asNumber(field(arena, "weaponKeen", "weapon_keen")) ?? 0,
    brutalBp: asNumber(field(arena, "weaponBrutal", "weapon_brutal")) ?? 0,
  };
}

function fightFromDecoded(arena: Record<string, unknown> | null): Fight | null {
  if (!arena) return null;
  const seed = asBytes(field(arena, "seed"));
  const player = body(field(arena, "player"));
  if (!seed || seed.length !== 32 || !player) return null;
  const count = asNumber(field(arena, "monsterCount", "monster_count")) ?? 0;
  const monsters = field(arena, "monsters");
  return {
    stepIndex: asNumber(field(arena, "stepIndex", "step_index")) ?? 0,
    roomW: asNumber(field(arena, "roomW", "room_w")) ?? 256,
    roomH: asNumber(field(arena, "roomH", "room_h")) ?? 256,
    room: asNumber(field(arena, "room")) ?? 1,
    player,
    foes: foes(monsters, count),
    shots: shots(field(arena, "shots")),
    bossAttack: asNumber(field(arena, "bossAttack", "boss_attack")) ?? 0,
    bossTelegraph: asNumber(field(arena, "bossTelegraph", "boss_telegraph")) ?? 0,
    bossCd: asNumber(field(arena, "bossCd", "boss_cd")) ?? 0,
    weapon: weaponOf(arena),
    seed,
  };
}

/** The Crater visit: the same arena in lair mode. */
function lairFromDecoded(arena: Record<string, unknown> | null): Lair | null {
  if (!arena) return null;
  const seed = asBytes(field(arena, "seed"));
  if (!seed || seed.length !== 32) return null;
  const monsters = field(arena, "monsters");
  const bossRecord = Array.isArray(monsters) && monsters[0] && typeof monsters[0] === "object" ? (monsters[0] as Record<string, unknown>) : null;
  const bossBody = bossRecord ? body(field(bossRecord, "body")) : null;
  const rawSparks = field(arena, "sparks");
  const sparks = Array.isArray(rawSparks)
    ? rawSparks
        .filter((spark) => spark && typeof spark === "object")
        .map((spark) => {
          const record = spark as Record<string, unknown>;
          return {
            x: asNumber(field(record, "x")) ?? 0,
            y: asNumber(field(record, "y")) ?? 0,
            vx: asNumber(field(record, "vx")) ?? 0,
            vy: asNumber(field(record, "vy")) ?? 0,
            life: asNumber(field(record, "life")) ?? 0,
            kind: asNumber(field(record, "kind")) ?? 0,
          } as LairShot;
        })
        .filter((spark) => spark.life > 0)
    : [];
  const player = body(field(arena, "player"));
  if (!player) return null;
  return {
    stepIndex: asNumber(field(arena, "stepIndex", "step_index")) ?? 0,
    player: {
      x: player.x,
      y: player.y,
      hp: player.hp,
      facing: player.facing,
      attackCd: player.attackCd,
      invuln: player.invuln,
      dashCd: player.dashCd,
      dashLeft: player.dashLeft,
    },
    boss: { x: bossBody?.x ?? 128, y: bossBody?.y ?? 96 },
    shots: shots(field(arena, "shots")),
    sparks,
    phase: asNumber(field(arena, "bossPhase", "boss_phase")) ?? 0,
    phaseStep: asNumber(field(arena, "bossTimer", "boss_timer")) ?? 0,
    attack: asNumber(field(arena, "bossAttack", "boss_attack")) ?? 0,
    telegraph: asNumber(field(arena, "bossTelegraph", "boss_telegraph")) ?? 0,
    cd: asNumber(field(arena, "bossCd", "boss_cd")) ?? 0,
    hits: asNumber(field(arena, "lairHits", "lair_hits")) ?? 0,
    marked: (asNumber(field(arena, "glare")) ?? 0) !== 0,
    unflushed: Number(asNumber(field(arena, "unflushedDamage", "unflushed_damage")) ?? 0),
    sparkValue: asNumber(field(arena, "sparkValue", "spark_value")) ?? 0,
    sparkHeal: asNumber(field(arena, "sparkHeal", "spark_heal")) ?? 0,
    weapon: weaponOf(arena) as LairWeapon,
    seed,
  };
}

function shots(value: unknown): Shot[] {
  if (!Array.isArray(value)) return [];
  const out: Shot[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const life = asNumber(field(record, "life"));
    if (life === null || life === 0) continue;
    out.push({
      x: asNumber(field(record, "x")) ?? 0,
      y: asNumber(field(record, "y")) ?? 0,
      vx: asNumber(field(record, "vx")) ?? 0,
      vy: asNumber(field(record, "vy")) ?? 0,
      life,
      kind: asNumber(field(record, "kind")) ?? 0,
    });
  }
  return out;
}

function foes(value: unknown, count: number): Foe[] {
  if (!Array.isArray(value)) return [];
  const out: Foe[] = [];
  for (const monster of value.slice(0, count)) {
    if (!monster || typeof monster !== "object") continue;
    const record = monster as Record<string, unknown>;
    const bodyValue = body(field(record, "body"));
    if (!bodyValue) continue;
    out.push({
      kind: asNumber(field(record, "kind")) ?? 0,
      body: bodyValue,
      aimX: asNumber(field(record, "aimX", "aim_x")) ?? bodyValue.x,
      aimY: asNumber(field(record, "aimY", "aim_y")) ?? bodyValue.y,
      aimAge: asNumber(field(record, "aimAge", "aim_age")) ?? 0,
    });
  }
  return out;
}

function body(value: unknown): Fighter | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const x = asNumber(field(record, "x"));
  const y = asNumber(field(record, "y"));
  const hp = asNumber(field(record, "hp"));
  if (x === null || y === null || hp === null) return null;
  return {
    x,
    y,
    hp,
    facing: asNumber(field(record, "facing")) ?? 0,
    attackCd: asNumber(field(record, "attackCd", "attack_cd")) ?? 0,
    invuln: asNumber(field(record, "invuln")) ?? 0,
    dashCd: asNumber(field(record, "dashCd", "dash_cd")) ?? 0,
    dashLeft: asNumber(field(record, "dashLeft", "dash_left")) ?? 0,
    slow: asNumber(field(record, "slow")) ?? 0,
  };
}

function decode(program: Program, data: Buffer): Record<string, unknown> | null {
  try {
    return program.coder.accounts.decode("Arena", data) as Record<string, unknown>;
  } catch {
    return null;
  }
}
