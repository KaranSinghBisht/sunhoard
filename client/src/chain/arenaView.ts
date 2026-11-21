import type { Program } from "@coral-xyz/anchor";
import { type Fight, type Foe, type Fighter } from "../shared/fight";
import { asBytes, asNumber, field } from "./bytes";

const MODE_FIGHT = 2;

export function arenaPhase(program: Program, data: Buffer): { fight: Fight | null; waiting: boolean } {
  const arena = decode(program, data);
  const mode = arena ? asNumber(field(arena, "mode")) : null;
  return { fight: mode === MODE_FIGHT ? fightFromDecoded(arena) : null, waiting: mode === 1 };
}

export function fightFromAccount(program: Program, data: Buffer): Fight | null {
  return arenaPhase(program, data).fight;
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
    player,
    foes: foes(monsters, count),
    seed,
  };
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
  };
}

function decode(program: Program, data: Buffer): Record<string, unknown> | null {
  try {
    return program.coder.accounts.decode("Arena", data) as Record<string, unknown>;
  } catch {
    return null;
  }
}
