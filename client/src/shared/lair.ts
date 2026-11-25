// The TypeScript mirror of logic/lair.rs. The Crater scene predicts with this
// and snaps to the chain, step for step.

import { sha256 } from "./sha";

const PLAYER_SPEED = 8;
const DASH_SPEED = 24;
const DASH_STEPS = 2;
const DASH_COOLDOWN = 20;
const ATTACK_STEPS = 4;
const REACH = 20;
const SHOT_SLOTS = 8;
const RARITY_BP = [10_000, 11_500, 13_000, 15_000, 17_500];
const WEAPON_BASE = [6, 10, 16];

export const RIME = 0;
export const GLOAMING = 1;
export const NOON = 2;
export const RIME_STEPS = 600;
export const GLOAMING_STEPS = 600;
export const NOON_STEPS = 300;
export const VISIT_STEPS = RIME_STEPS + GLOAMING_STEPS + NOON_STEPS;
export const MARK_DAMAGE_BP = 15_000;
export const MARK_TAKEN_BP = 13_000;
export const SPARK_EVERY = 10;
export const SPARK_LIFE = 30;
export const LANTERNS: Array<[number, number]> = [
  [64, 64],
  [192, 64],
  [64, 192],
  [192, 192],
];
export const LIGHT_RADIUS = 36;
export const SCOOP_RADIUS = 16;

export const SHOT_FROST = 3;
export const SHOT_STONE = 4;
export const SHOT_BEAM = 5;
export const SHOT_RAY = 6;

export interface LairWeapon {
  material: number;
  rarity: number;
  keenPpm: number;
  brutalBp: number;
}

export interface LairFighter {
  x: number;
  y: number;
  hp: number;
  facing: number;
  attackCd: number;
  invuln: number;
  dashCd: number;
  dashLeft: number;
}

export interface LairShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  kind: number;
}

export interface LairIntent {
  dx: number;
  dy: number;
  attack: boolean;
  dash: boolean;
}

export interface Lair {
  stepIndex: number;
  player: LairFighter;
  boss: { x: number; y: number };
  shots: LairShot[];
  sparks: LairShot[];
  phase: number;
  phaseStep: number;
  attack: number;
  telegraph: number;
  cd: number;
  hits: number;
  marked: boolean;
  unflushed: number;
  sparkValue: number;
  sparkHeal: number;
  weapon: LairWeapon;
  seed: Uint8Array;
}

export function openLair(seed: Uint8Array, marked: boolean, weapon: LairWeapon): Lair {
  return {
    stepIndex: 0,
    player: { x: 128, y: 224, hp: 100, facing: 0, attackCd: 0, invuln: 0, dashCd: 0, dashLeft: 0 },
    boss: { x: 128, y: 96 },
    shots: [],
    sparks: [],
    phase: RIME,
    phaseStep: 0,
    attack: 0,
    telegraph: 0,
    cd: 0,
    hits: 0,
    marked,
    unflushed: 0,
    sparkValue: 0,
    sparkHeal: 0,
    weapon,
    seed,
  };
}

export function cloneLair(lair: Lair): Lair {
  return {
    ...lair,
    player: { ...lair.player },
    boss: { ...lair.boss },
    shots: lair.shots.map((shot) => ({ ...shot })),
    sparks: lair.sparks.map((shot) => ({ ...shot })),
    weapon: { ...lair.weapon },
  };
}

export interface LairStep {
  damage: number;
  spilled: boolean;
  drifted: number;
  done: boolean;
}

export function stepLair(lair: Lair, intent: LairIntent, pot: number): LairStep {
  const out: LairStep = { damage: 0, spilled: false, drifted: 0, done: false };
  if (lair.player.hp <= 0) {
    lair.stepIndex += 1;
    out.done = true;
    return out;
  }
  if (lair.phaseStep >= VISIT_STEPS) {
    out.done = true;
    return out;
  }
  cool(lair.player);
  beginDash(lair.player, intent);
  const speed = lair.player.dashLeft > 0 ? DASH_SPEED : PLAYER_SPEED;
  moveCardinal(lair.player, intent.dx, intent.dy, speed);
  stepPhases(lair, pot);
  swing(lair, intent, pot, out);
  stepShots(lair);
  const expired = expireSparks(lair);
  if (expired > 0) out.drifted = lair.sparkHeal * expired;
  lair.stepIndex += 1;
  return out;
}

function cool(body: LairFighter): void {
  body.attackCd = Math.max(0, body.attackCd - 1);
  body.invuln = Math.max(0, body.invuln - 1);
  body.dashCd = Math.max(0, body.dashCd - 1);
  body.dashLeft = Math.max(0, body.dashLeft - 1);
}

function beginDash(body: LairFighter, intent: LairIntent): void {
  if (!intent.dash || body.dashCd > 0 || body.dashLeft > 0) return;
  body.dashLeft = DASH_STEPS;
  body.dashCd = DASH_COOLDOWN;
  if (body.invuln < DASH_STEPS) body.invuln = DASH_STEPS;
}

function moveCardinal(body: LairFighter, dx: number, dy: number, speed: number): void {
  const magnitude = dx !== 0 && dy !== 0 ? Math.trunc((speed * 181) / 256) : speed;
  body.facing = facing(dx, dy, body.facing);
  body.x = Math.max(0, Math.min(256, body.x + Math.sign(dx) * magnitude));
  body.y = Math.max(0, Math.min(256, body.y + Math.sign(dy) * magnitude));
}

function facing(dx: number, dy: number, current: number): number {
  if (dx === 0 && dy === 0) return current;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 0 : 2;
  return dy > 0 ? 1 : 3;
}

function stepPhases(lair: Lair, pot: number): void {
  lair.phaseStep += 1;
  lair.phase = lair.phaseStep <= RIME_STEPS ? RIME : lair.phaseStep <= RIME_STEPS + GLOAMING_STEPS ? GLOAMING : NOON;
  if (lair.phase === GLOAMING && lair.phaseStep % 5 === 0 && !inLight(lair.player.x, lair.player.y)) {
    lair.player.hp -= 1;
  }
  const gap = lair.phase === NOON ? 30 : 50;
  if (lair.telegraph > 0) {
    lair.telegraph -= 1;
    if (lair.telegraph === 0) fire(lair);
    return;
  }
  if (lair.cd > 0) lair.cd -= 1;
  if (lair.cd === 0) {
    lair.attack = pickAttack(lair);
    lair.telegraph = 6;
    lair.cd = gap;
  }
  void pot;
}

function pickAttack(lair: Lair): number {
  const roll = word(expand(lair.seed, lair.stepIndex), 0) % 3;
  if (lair.phase === RIME) {
    if (roll === 0) return 1; // Breath
    if (roll === 2 && lair.marked) return 3; // Beam
    return 2; // Hail
  }
  if (lair.phase === GLOAMING) {
    return roll === 0 ? 4 : 2; // Tail or hail
  }
  if (roll === 0) return 5; // Dash
  if (roll === 1) return 6; // Sunburst
  return 2;
}

function fire(lair: Lair): void {
  const px = lair.player.x;
  const py = lair.player.y;
  const bx = lair.boss.x;
  const by = lair.boss.y;
  if (lair.attack === 1) {
    const [vx, vy] = aim(px, py, bx, by, 3);
    addShot(lair, bx, by, vx, vy, 120, SHOT_FROST);
    return;
  }
  if (lair.attack === 2) {
    for (const offset of [-24, 0, 24]) {
      const [vx, vy] = aim(px + offset, py, bx, by, 5);
      addShot(lair, bx, by, vx, vy, 60, SHOT_STONE);
    }
    return;
  }
  if (lair.attack === 3) {
    const [vx, vy] = aim(px, py, bx, by, 8);
    addShot(lair, bx, by, vx, vy, 40, SHOT_BEAM);
    return;
  }
  if (lair.attack === 4) {
    if (dist2(bx, by, px, py) <= 28 * 28) lair.player.hp -= scaleTaken(lair, 20);
    return;
  }
  if (lair.attack === 5) {
    lair.boss.x = Math.max(0, Math.min(256, px - 12));
    lair.boss.y = Math.max(0, Math.min(256, py - 12));
    if (dist2(lair.boss.x, lair.boss.y, px, py) <= 20 * 20) lair.player.hp -= scaleTaken(lair, 25);
    return;
  }
  if (lair.attack === 6) {
    for (const [vx, vy] of [
      [4, 0],
      [-4, 0],
      [0, 4],
      [0, -4],
    ]) {
      addShot(lair, bx, by, vx, vy, 60, SHOT_RAY);
    }
  }
}

function swing(lair: Lair, intent: LairIntent, pot: number, out: LairStep): void {
  if (!intent.attack || lair.player.attackCd > 0) return;
  lair.player.attackCd = ATTACK_STEPS;
  if (!inArc(lair.player, lair.boss.x, lair.boss.y)) return;
  const dealt = damage(lair.weapon, lair.seed, lair.stepIndex, 0);
  if (dealt <= 0) return;
  const counted = Math.trunc((dealt * (lair.marked ? MARK_DAMAGE_BP : 10_000)) / 10_000);
  lair.unflushed += counted;
  out.damage = counted;
  lair.hits += 1;
  if (lair.phase === GLOAMING && lair.hits % SPARK_EVERY === 0) {
    const value = Math.min(Math.trunc((pot * 500) / 1_000_000), 1_000);
    spawnSpark(lair, value, counted);
    out.spilled = true;
  }
}

function spawnSpark(lair: Lair, value: number, heal: number): void {
  if (lair.sparks.length >= SHOT_SLOTS) return;
  lair.sparks.push({ x: lair.boss.x, y: lair.boss.y, vx: 0, vy: 0, life: SPARK_LIFE, kind: 0 });
  lair.sparkValue = value;
  lair.sparkHeal = heal;
}

function stepShots(lair: Lair): void {
  const next: LairShot[] = [];
  for (const shot of lair.shots) {
    if (shot.life === 0) continue;
    const moved = { ...shot };
    moved.x += moved.vx;
    moved.y += moved.vy;
    moved.life -= 1;
    const outside = moved.x < 0 || moved.y < 0 || moved.x > 256 || moved.y > 256 || moved.life === 0;
    if (outside) continue;
    if (dist2(lair.player.x, lair.player.y, moved.x, moved.y) <= 100) {
      const safe = moved.kind === SHOT_FROST && inLight(lair.player.x, lair.player.y);
      if (!safe) {
        const dmg = moved.kind === SHOT_FROST ? 25 : moved.kind === SHOT_STONE ? 10 : moved.kind === SHOT_BEAM ? 30 : 15;
        lair.player.hp -= scaleTaken(lair, dmg);
      }
      continue;
    }
    next.push(moved);
  }
  lair.shots = next;
}

function expireSparks(lair: Lair): number {
  let expired = 0;
  const next: LairShot[] = [];
  for (const spark of lair.sparks) {
    if (spark.life === 0) continue;
    const moved = { ...spark, life: spark.life - 1 };
    if (moved.life === 0) {
      expired += 1;
      continue;
    }
    next.push(moved);
  }
  lair.sparks = next;
  return expired;
}

export function scoopable(lair: Lair, px: number, py: number): number {
  const index = lair.sparks.findIndex(
    (spark) => spark.life > 0 && dist2(px, py, spark.x, spark.y) <= SCOOP_RADIUS * SCOOP_RADIUS,
  );
  return index;
}

export function inLight(px: number, py: number): boolean {
  return LANTERNS.some(([x, y]) => dist2(px, py, x, y) <= LIGHT_RADIUS * LIGHT_RADIUS);
}

function scaleTaken(lair: Lair, dmg: number): number {
  if (!lair.marked) return dmg;
  return Math.trunc((dmg * MARK_TAKEN_BP) / 10_000);
}

function inArc(player: LairFighter, tx: number, ty: number): boolean {
  const dx = tx - player.x;
  const dy = ty - player.y;
  const reach = dx * dx + dy * dy;
  if (reach === 0) return true;
  if (reach > REACH * REACH) return false;
  const facingX = player.facing === 0 ? 1 : player.facing === 2 ? -1 : 0;
  const facingY = player.facing === 1 ? 1 : player.facing === 3 ? -1 : 0;
  const dot = dx * facingX + dy * facingY;
  return dot > 0 && dot * dot * 2 >= reach;
}

function aim(tx: number, ty: number, fx: number, fy: number, speed: number): [number, number] {
  const dx = tx - fx;
  const dy = ty - fy;
  const dist = isqrt(dx * dx + dy * dy);
  if (dist === 0) return [0, 0];
  return [Math.trunc((dx * speed) / dist), Math.trunc((dy * speed) / dist)];
}

function addShot(lair: Lair, x: number, y: number, vx: number, vy: number, life: number, kind: number): void {
  if (lair.shots.length >= SHOT_SLOTS) return;
  lair.shots.push({ x, y, vx, vy, life, kind });
}

function damage(weapon: LairWeapon, seed: Uint8Array, step: number, hit: number): number {
  const base = Math.trunc((WEAPON_BASE[weapon.material] * RARITY_BP[weapon.rarity]) / 10_000);
  const roll = ppm(word(expandHit(seed, step, hit), 0));
  const chance = Math.min(1_000_000, 50_000 + weapon.keenPpm);
  if (roll >= chance) return base;
  return Math.trunc((base * (15_000 + weapon.brutalBp)) / 10_000);
}

/** sha256(seed ‖ step), matching `logic::roll::expand`. */
function expand(seed: Uint8Array, step: number): Uint8Array {
  const bytes = new Uint8Array(seed.length + 8);
  bytes.set(seed);
  new DataView(bytes.buffer).setBigUint64(seed.length, BigInt(step), true);
  return sha256(bytes);
}

/** sha256(seed ‖ step ‖ hit), matching `logic::roll::expand_hit`. */
function expandHit(seed: Uint8Array, step: number, hit: number): Uint8Array {
  const bytes = new Uint8Array(seed.length + 10);
  bytes.set(seed);
  new DataView(bytes.buffer).setBigUint64(seed.length, BigInt(step), true);
  new DataView(bytes.buffer).setUint16(seed.length + 8, hit, true);
  return sha256(bytes);
}

function ppm(value: number): number {
  return Number((BigInt(value) * 1_000_000n) / (1n << 32n));
}

function word(bytes: Uint8Array, index: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(index * 4, true);
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
}

function isqrt(value: number): number {
  if (value <= 0) return 0;
  let x = value;
  let y = Math.trunc((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.trunc((x + Math.trunc(value / x)) / 2);
  }
  return x;
}
