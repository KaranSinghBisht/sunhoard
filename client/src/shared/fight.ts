// The TypeScript mirror of logic/arena.rs + logic/fight.rs. It must match the
// Rust step for step: the cellar predicts with this and snaps to the chain.

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
const SLOWED_SPEED = 5;
const SHOT_HIT = 10;
const SHOT_SLOTS = 8;
const MONSTER_HP = [18, 40, 24];
const MONSTER_DMG = [5, 8, 6];
const MONSTER_SPEED = [6, 2, 5];
const MONSTER_AGGRO = [96, 64, 128];
const MONSTER_REAIM = [1, 1, 5];
const WEAPON_BASE = [6, 10, 16];
const ROOMS = 6;
const ROOM_MONSTERS = [5, 6, 7, 6, 7, 1];
const SNUFFER_HP = 900;
const SNUFFER_SPEED = 2;
const BOSS_TELEGRAPH = 6;
const BOSS_GAP = 60;
const EMBER_DMG = 10;
const EMBER_SPEED = 5;
const EMBER_LIFE = 40;
const WICK_DMG = 16;
const WICK_LIFE = 90;
const SNUFF_DMG = 18;
const SNUFF_RANGE = 24;
const FROST_STEPS = 20;

export const SHOT_EMBER = 1;
export const SHOT_WICK = 2;

/** The run's weapon: material, rarity and the two combat traits. */
export interface Weapon {
  material: number;
  rarity: number;
  keenPpm: number;
  brutalBp: number;
}

/** The starter stone axe. */
export const STONE_WEAPON: Weapon = { material: 0, rarity: 0, keenPpm: 0, brutalBp: 0 };

const RARITY_BP = [10_000, 11_500, 13_000, 15_000, 17_500];

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
  slow: number;
}

export interface Foe {
  kind: number;
  body: Fighter;
  aimX: number;
  aimY: number;
  aimAge: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  kind: number;
}

export interface Fight {
  stepIndex: number;
  roomW: number;
  roomH: number;
  room: number;
  player: Fighter;
  foes: Foe[];
  shots: Shot[];
  bossAttack: number;
  bossTelegraph: number;
  bossCd: number;
  weapon: Weapon;
  seed: Uint8Array;
}

function fighter(x: number, y: number, hp: number): Fighter {
  return { x, y, hp, facing: 0, attackCd: 0, invuln: 0, dashCd: 0, dashLeft: 0, slow: 0 };
}

function foe(kind: number, x: number, y: number): Foe {
  const hp = kind === 3 ? SNUFFER_HP : MONSTER_HP[kind];
  return { kind, body: fighter(x, y, hp), aimX: x, aimY: y, aimAge: kind === 3 ? 0 : MONSTER_REAIM[kind] - 1 };
}

function emptyShot(): Shot {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, kind: 0 };
}

function blank(seed: Uint8Array): Fight {
  return {
    stepIndex: 0,
    roomW: ROOM,
    roomH: ROOM,
    room: 0,
    player: fighter(32, 128, PLAYER_HP),
    foes: [],
    shots: Array.from({ length: SHOT_SLOTS }, emptyShot),
    bossAttack: 0,
    bossTelegraph: 0,
    bossCd: 0,
    weapon: STONE_WEAPON,
    seed,
  };
}

/** Opens room `room` (1..=6) of a run, with the HP carried between rooms. */
export function openRoom(seed: Uint8Array, room = 1, startHp = PLAYER_HP): Fight {
  const fight = blank(seed);
  fight.room = room;
  fight.player.hp = Math.max(1, Math.min(PLAYER_HP, startHp));
  if (room === ROOMS) {
    fight.foes.push(foe(3, ROOM / 2, ROOM / 2));
    return fight;
  }
  const count = ROOM_MONSTERS[room - 1];
  const layout = room % 3;
  for (let index = 0; index < count; index += 1) {
    const roll = expand(seed, room * 8 + index);
    const [x, y] = spot(layout, index, roll);
    fight.foes.push(foe(word(roll, 0) % 3, x, y));
  }
  return fight;
}

/** Three layouts, reused across the six rooms; mirrors logic/fight.rs. */
function spot(layout: number, index: number, roll: Uint8Array): [number, number] {
  if (layout === 1) {
    const cx = 110 + (word(roll, 1) % 70);
    const cy = 90 + (word(roll, 2) % 90);
    const col = (index % 3) - 1;
    const row = (Math.floor(index / 3) % 3) - 1;
    return [cx + col * 26, cy + row * 26];
  }
  if (layout === 2) {
    return [40 + index * 28, 40 + index * 24];
  }
  return [60 + (word(roll, 1) % 140), 40 + (word(roll, 2) % 170)];
}

export function stepFight(fight: Fight, intent: Intent, weapon: Weapon = fight.weapon): void {
  if (intent.dx < -1 || intent.dx > 1 || intent.dy < -1 || intent.dy > 1) throw new Error("bad intent");
  if (fight.player.hp <= 0) {
    fight.stepIndex += 1;
    return;
  }
  tick(fight);
  beginDash(fight.player, intent);
  const speed = fight.player.dashLeft > 0 ? DASH_SPEED : fight.player.slow > 0 ? SLOWED_SPEED : PLAYER_SPEED;
  moveCardinal(fight.player, intent.dx, intent.dy, speed, fight.roomW, fight.roomH);
  stepBoss(fight, weapon);
  for (const monster of fight.foes) {
    if (monster.kind === 3) continue;
    steer(monster, fight.player.x, fight.player.y, fight.roomW, fight.roomH);
  }
  swing(fight, intent, weapon);
  stepShots(fight);
  contact(fight);
  fight.stepIndex += 1;
}

export function cloneFight(fight: Fight): Fight {
  return {
    stepIndex: fight.stepIndex,
    roomW: fight.roomW,
    roomH: fight.roomH,
    room: fight.room,
    player: { ...fight.player },
    foes: fight.foes.map((monster) => ({ ...monster, body: { ...monster.body } })),
    shots: fight.shots.map((shot) => ({ ...shot })),
    bossAttack: fight.bossAttack,
    bossTelegraph: fight.bossTelegraph,
    bossCd: fight.bossCd,
    weapon: { ...fight.weapon },
    seed: fight.seed,
  };
}

export function replay(fight: Fight, steps: number, intent: Intent): Fight {
  const next = cloneFight(fight);
  const count = Math.max(0, Math.min(steps, 20));
  for (let index = 0; index < count; index += 1) stepFight(next, intent);
  return next;
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
  body.slow = Math.max(0, body.slow - 1);
}

function beginDash(body: Fighter, intent: Intent): void {
  if (!intent.dash || body.dashCd > 0 || body.dashLeft > 0) return;
  body.dashLeft = DASH_STEPS;
  body.dashCd = DASH_COOLDOWN;
  if (body.invuln < DASH_STEPS) body.invuln = DASH_STEPS;
}

function stepBoss(fight: Fight, weapon: Weapon): void {
  const boss = fight.foes.find((monster) => monster.kind === 3 && monster.body.hp > 0);
  if (!boss) return;
  if (fight.bossTelegraph > 0) {
    fight.bossTelegraph -= 1;
    if (fight.bossTelegraph === 0) fireBoss(fight);
    return;
  }
  if (fight.bossCd > 0) fight.bossCd -= 1;
  const px = fight.player.x;
  const py = fight.player.y;
  if (dist2(boss.body.x, boss.body.y, px, py) > 40 * 40) {
    moveToward(boss.body, px, py, SNUFFER_SPEED, fight.roomW, fight.roomH);
  }
  if (fight.bossCd === 0) {
    fight.bossAttack = (word(expand(fight.seed, fight.stepIndex), 0) % 3) + 1;
    fight.bossTelegraph = BOSS_TELEGRAPH;
    fight.bossCd = BOSS_GAP;
  }
}

function fireBoss(fight: Fight): void {
  const boss = fight.foes.find((monster) => monster.kind === 3);
  if (!boss) return;
  const px = fight.player.x;
  const py = fight.player.y;
  const bx = boss.body.x;
  const by = boss.body.y;
  if (fight.bossAttack === 2) {
    addShot(fight, { x: 0, y: 0, vx: 3, vy: 3, life: WICK_LIFE, kind: SHOT_WICK });
    addShot(fight, { x: fight.roomW, y: 0, vx: -3, vy: 3, life: WICK_LIFE, kind: SHOT_WICK });
    return;
  }
  if (fight.bossAttack === 3) {
    boss.body.x = Math.max(0, Math.min(fight.roomW, px - 20));
    boss.body.y = Math.max(0, Math.min(fight.roomH, py - 20));
    if (dist2(boss.body.x, boss.body.y, px, py) <= SNUFF_RANGE * SNUFF_RANGE) {
      fight.player.hp -= SNUFF_DMG;
      fight.player.slow = FROST_STEPS;
    }
    return;
  }
  const [vx, vy] = aim(px, py, bx, by, EMBER_SPEED);
  addShot(fight, { x: bx, y: by, vx, vy, life: EMBER_LIFE, kind: SHOT_EMBER });
  const [vx2, vy2] = aim(px - 24, py + 24, bx, by, EMBER_SPEED);
  addShot(fight, { x: bx, y: by, vx: vx2, vy: vy2, life: EMBER_LIFE, kind: SHOT_EMBER });
  const [vx3, vy3] = aim(px + 24, py - 24, bx, by, EMBER_SPEED);
  addShot(fight, { x: bx, y: by, vx: vx3, vy: vy3, life: EMBER_LIFE, kind: SHOT_EMBER });
}

function addShot(fight: Fight, shot: Shot): void {
  for (let index = 0; index < SHOT_SLOTS; index += 1) {
    if (fight.shots[index].life === 0) {
      fight.shots[index] = shot;
      return;
    }
  }
}

/** A velocity toward the target at the given speed, integers only. */
function aim(tx: number, ty: number, fx: number, fy: number, speed: number): [number, number] {
  const dx = tx - fx;
  const dy = ty - fy;
  const dist = isqrt(dx * dx + dy * dy);
  if (dist === 0) return [0, 0];
  return [Math.trunc((dx * speed) / dist), Math.trunc((dy * speed) / dist)];
}

function stepShots(fight: Fight): void {
  let live = 0;
  for (let index = 0; index < SHOT_SLOTS; index += 1) {
    const shot = fight.shots[index];
    if (!shot || shot.life === 0) continue;
    const next = { ...shot };
    next.x += next.vx;
    next.y += next.vy;
    next.life -= 1;
    const outside = next.x < 0 || next.y < 0 || next.x > fight.roomW || next.y > fight.roomH || next.life === 0;
    if (outside) continue;
    if (dist2(fight.player.x, fight.player.y, next.x, next.y) <= SHOT_HIT * SHOT_HIT) {
      fight.player.hp -= next.kind === SHOT_EMBER ? EMBER_DMG : WICK_DMG;
      continue;
    }
    fight.shots[live] = next;
    live += 1;
  }
  for (let index = live; index < SHOT_SLOTS; index += 1) fight.shots[index] = emptyShot();
}

function steer(monster: Foe, px: number, py: number, roomW: number, roomH: number): void {
  if (monster.body.hp <= 0) return;
  const aggro = MONSTER_AGGRO[monster.kind];
  if (dist2(monster.body.x, monster.body.y, px, py) > aggro * aggro) return;
  monster.aimAge += 1;
  if (monster.aimAge >= MONSTER_REAIM[monster.kind]) {
    monster.aimX = px;
    monster.aimY = py;
    monster.aimAge = 0;
  }
  moveToward(monster.body, monster.aimX, monster.aimY, MONSTER_SPEED[monster.kind], roomW, roomH);
}

function swing(fight: Fight, intent: Intent, weapon: Weapon): void {
  if (!intent.attack || fight.player.attackCd > 0) return;
  fight.player.attackCd = ATTACK_STEPS;
  let hit = 0;
  for (const monster of fight.foes) {
    if (monster.body.hp <= 0) continue;
    if (!inArc(fight.player, monster.body.x, monster.body.y)) continue;
    monster.body.hp -= damage(weapon, fight.seed, fight.stepIndex, hit);
    hit += 1;
  }
}

function contact(fight: Fight): void {
  if (fight.player.invuln > 0) return;
  for (const monster of fight.foes) {
    if (monster.body.hp <= 0 || monster.kind === 3) continue;
    if (dist2(fight.player.x, fight.player.y, monster.body.x, monster.body.y) > CONTACT * CONTACT) continue;
    fight.player.hp -= MONSTER_DMG[monster.kind];
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

function damage(weapon: Weapon, seed: Uint8Array, step: number, hit: number): number {
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
