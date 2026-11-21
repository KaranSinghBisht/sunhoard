import { sha256 } from "./sha";

const PLAYER_HP = 100;
const PLAYER_SPEED = 8;
const DASH_SPEED = 24;
const DASH_STEPS = 2;
const DASH_COOLDOWN = 20;
const ATTACK_STEPS = 4;
const INVULN_STEPS = 6;
const REACH = 20;
const CONTACT = 8;
const ROOM = 256;
const MONSTER_HP = [18, 40, 24];
const MONSTER_DMG = [5, 8, 6];
const MONSTER_SPEED = [6, 2, 5];
const MONSTER_AGGRO = [96, 64, 128];
const MONSTER_REAIM = [1, 1, 5];
const WEAPON_BASE = [6, 10, 16];

export interface Intent {
  dx: number;
  dy: number;
  attack: boolean;
  dash: boolean;
}

export interface Fighter {
  x: number;
  y: number;
  hp: number;
  facing: number;
  attackCd: number;
  invuln: number;
  dashCd: number;
  dashLeft: number;
}

export interface Foe {
  kind: number;
  body: Fighter;
  aimX: number;
  aimY: number;
  aimAge: number;
}

export interface Fight {
  stepIndex: number;
  roomW: number;
  roomH: number;
  player: Fighter;
  foes: Foe[];
  seed: Uint8Array;
}

export function openRoom(seed: Uint8Array): Fight {
  const fight: Fight = {
    stepIndex: 0,
    roomW: ROOM,
    roomH: ROOM,
    player: fighter(32, 128, PLAYER_HP),
    foes: [],
    seed,
  };
  for (let kind = 0; kind < 3; kind += 1) {
    const x = 80 + (seed[kind] % 140);
    const y = 40 + (seed[8 + kind] % 160);
    fight.foes.push(foe(kind, x, y));
  }
  return fight;
}

export function stepFight(fight: Fight, intent: Intent, material = 0): void {
  if (intent.dx < -1 || intent.dx > 1 || intent.dy < -1 || intent.dy > 1) throw new Error("bad intent");
  if (fight.player.hp <= 0) {
    fight.stepIndex += 1;
    return;
  }
  tick(fight);
  beginDash(fight.player, intent);
  const speed = fight.player.dashLeft > 0 ? DASH_SPEED : PLAYER_SPEED;
  moveCardinal(fight.player, intent.dx, intent.dy, speed, fight.roomW, fight.roomH);
  for (const monster of fight.foes) steer(monster, fight.player.x, fight.player.y, fight.roomW, fight.roomH);
  swing(fight, intent, material);
  contact(fight);
  fight.stepIndex += 1;
}

export function cloneFight(fight: Fight): Fight {
  return {
    stepIndex: fight.stepIndex,
    roomW: fight.roomW,
    roomH: fight.roomH,
    player: { ...fight.player },
    foes: fight.foes.map((monster) => ({ ...monster, body: { ...monster.body } })),
    seed: fight.seed,
  };
}

export function replay(fight: Fight, steps: number, intent: Intent): Fight {
  const next = cloneFight(fight);
  const count = Math.max(0, Math.min(steps, 20));
  for (let index = 0; index < count; index += 1) stepFight(next, intent);
  return next;
}

function foe(kind: number, x: number, y: number): Foe {
  return { kind, body: fighter(x, y, stat(MONSTER_HP, kind)), aimX: x, aimY: y, aimAge: stat(MONSTER_REAIM, kind) - 1 };
}

function fighter(x: number, y: number, hp: number): Fighter {
  return { x, y, hp, facing: 0, attackCd: 0, invuln: 0, dashCd: 0, dashLeft: 0 };
}

function tick(fight: Fight): void {
  cool(fight.player);
  for (const monster of fight.foes) cool(monster.body);
}

function cool(body: Fighter): void {
  body.attackCd = Math.max(0, body.attackCd - 1);
  body.invuln = Math.max(0, body.invuln - 1);
  body.dashCd = Math.max(0, body.dashCd - 1);
  body.dashLeft = Math.max(0, body.dashLeft - 1);
}

function beginDash(body: Fighter, intent: Intent): void {
  if (!intent.dash || body.dashCd > 0 || body.dashLeft > 0) return;
  body.dashLeft = DASH_STEPS;
  body.dashCd = DASH_COOLDOWN;
  if (body.invuln < DASH_STEPS) body.invuln = DASH_STEPS;
}

function steer(monster: Foe, px: number, py: number, roomW: number, roomH: number): void {
  if (monster.body.hp <= 0) return;
  const aggro = stat(MONSTER_AGGRO, monster.kind);
  if (dist2(monster.body.x, monster.body.y, px, py) > aggro * aggro) return;
  monster.aimAge += 1;
  if (monster.aimAge >= stat(MONSTER_REAIM, monster.kind)) {
    monster.aimX = px;
    monster.aimY = py;
    monster.aimAge = 0;
  }
  moveToward(monster.body, monster.aimX, monster.aimY, stat(MONSTER_SPEED, monster.kind), roomW, roomH);
}

function swing(fight: Fight, intent: Intent, material: number): void {
  if (!intent.attack || fight.player.attackCd > 0) return;
  fight.player.attackCd = ATTACK_STEPS;
  let hit = 0;
  for (const monster of fight.foes) {
    if (monster.body.hp <= 0) continue;
    if (!inArc(fight.player, monster.body.x, monster.body.y)) continue;
    monster.body.hp -= damage(material, fight.seed, fight.stepIndex, hit);
    hit += 1;
  }
}

function contact(fight: Fight): void {
  if (fight.player.invuln > 0) return;
  for (const monster of fight.foes) {
    if (monster.body.hp <= 0) continue;
    if (dist2(fight.player.x, fight.player.y, monster.body.x, monster.body.y) > CONTACT * CONTACT) continue;
    fight.player.hp -= stat(MONSTER_DMG, monster.kind);
    fight.player.invuln = INVULN_STEPS;
    return;
  }
}

function moveCardinal(body: Fighter, dx: number, dy: number, speed: number, roomW: number, roomH: number): void {
  const magnitude = dx !== 0 && dy !== 0 ? Math.trunc((speed * 181) / 256) : speed;
  body.facing = facing(dx, dy, body.facing);
  body.x = place(body.x, Math.sign(dx) * magnitude, roomW);
  body.y = place(body.y, Math.sign(dy) * magnitude, roomH);
}

function moveToward(body: Fighter, tx: number, ty: number, speed: number, roomW: number, roomH: number): void {
  const dx = tx - body.x;
  const dy = ty - body.y;
  const dist = isqrt(dx * dx + dy * dy);
  if (dist === 0) return;
  const step = Math.min(speed, dist);
  const sx = Math.trunc((dx * step) / dist);
  const sy = Math.trunc((dy * step) / dist);
  body.facing = facing(sx, sy, body.facing);
  body.x = place(body.x, sx, roomW);
  body.y = place(body.y, sy, roomH);
}

function damage(material: number, seed: Uint8Array, step: number, hit: number): number {
  const base = WEAPON_BASE[material];
  const roll = ppm(word(expandHit(seed, step, hit)));
  if (roll >= 50_000) return base;
  return Math.trunc((base * 15_000) / 10_000);
}

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

function word(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
}

function inArc(player: Fighter, tx: number, ty: number): boolean {
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

function facing(dx: number, dy: number, current: number): number {
  if (dx === 0 && dy === 0) return current;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 0 : 2;
  return dy > 0 ? 1 : 3;
}

function place(value: number, delta: number, hi: number): number {
  return Math.max(0, Math.min(hi, value + delta));
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

function stat(table: number[], kind: number): number {
  const value = table[kind];
  if (value === undefined) throw new Error("bad monster");
  return value;
}
