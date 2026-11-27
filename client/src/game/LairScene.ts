import { pressed, textInput } from "./touch";
import Phaser from "phaser";
import { playMusic, playSfx } from "../art/sound";
import { log } from "../chain/log";
import { uiText } from "../content/text";
import { cloneLair, scoopable, stepLair, type Lair, type LairIntent } from "../shared/lair";
import { pushLairIntent, readChainLair } from "./lairFeed";
import { ORIGIN_X, ORIGIN_Y, roomTiles, sconces, sheetColumn } from "./cellar/room";
import { drawDanger } from "./fight/danger";
import { frameRoom } from "./fight/frame";
import { Juice } from "./fight/juice";
import { drawSwing } from "./fight/swing";
import { DropWatch } from "./fight/watch";
import { showRoomNote } from "./labels";
import { Night, NIGHT_BELOW } from "./meadow/night";
import {
  DRAGON_BODY1,
  DRAGON_BODY2,
  DRAGON_HEAD,
  DRAGON_TAIL,
  DRAGON_WING,
  DUNGEON,
  KEEPER,
  SHADOW,
  keeperFrame,
} from "./sheets";
import { useHud } from "../ui/store";

const STEP_MS = 100;
const MAX_AHEAD = 20;
const KEEPER_HP = 100;
const HUD_DEPTH = 6000;
const TELEGRAPH_STEPS = 6;
/** shared/lair.ts: the tail sweep reaches 28 around Old Gloam, the dash 20 around where the keeper stands. */
const TAIL = 4;
const TAIL_REACH = 28;
const DASH = 5;
const DASH_REACH = 20;
/** The watch's keys: the keeper's HP, the keeper's own blows and the damage they carried. */
const KEEPER_KEY = 0;
const BLOWS_KEY = 1;
const DEALT_KEY = 2;

const LANTERNS = [
  [64, 64],
  [192, 64],
  [64, 192],
  [192, 192],
];

export class LairScene extends Phaser.Scene {
  private keeper!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private dragonParts: Phaser.GameObjects.Image[] = [];
  private wingLeft!: Phaser.GameObjects.Image;
  private wingRight!: Phaser.GameObjects.Image;
  private dragonHead!: Phaser.GameObjects.Image;
  private dragonBody1!: Phaser.GameObjects.Image;
  private dragonBody2!: Phaser.GameObjects.Image;
  private dragonTail!: Phaser.GameObjects.Image;
  private trail: Array<{ x: number; y: number }> = [];
  private bars!: Phaser.GameObjects.Graphics;
  private night!: Night;
  private base: Lair | null = null;
  private ahead = 0;
  private seen = -1;
  private acc = 0;
  private sent = "";
  private lastAttackCd = 0;
  private swingAt = -1e9;
  private readonly watch = new DropWatch();
  private juice!: Juice;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<"a" | "d" | "w" | "s" | "shift", Phaser.Input.Keyboard.Key>;

  constructor() {
    super("lair");
  }

  preload(): void {
    this.load.spritesheet("dungeon", DUNGEON, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("keeper", KEEPER, { frameWidth: 16, frameHeight: 16 });
    this.load.image("dragon-head", DRAGON_HEAD);
    this.load.image("dragon-wing", DRAGON_WING);
    this.load.image("dragon-body1", DRAGON_BODY1);
    this.load.image("dragon-body2", DRAGON_BODY2);
    this.load.image("dragon-tail", DRAGON_TAIL);
    this.load.image("shadow", SHADOW);
  }

  create(): void {
    this.base = null;
    this.seen = -1;
    this.sent = "";
    this.trail = [];
    this.lastAttackCd = 0;
    this.swingAt = -1e9;
    this.watch.reset();
    this.cameras.main.setBackgroundColor("#0e1419");
    for (const tile of roomTiles()) this.add.image(tile.x, tile.y, "dungeon", tile.frame).setDepth(0);
    this.shadow = this.add.image(0, 0, "shadow").setAlpha(0.4).setVisible(false);
    this.keeper = this.add.sprite(ORIGIN_X, ORIGIN_Y, "keeper", 0).setOrigin(0.5, 0.85).setVisible(false);

    // Articulated Old Gloam dragon rig (docs/ART.md §6).
    this.dragonTail = this.add.image(0, 0, "dragon-tail").setOrigin(0.5, 0.5).setVisible(false);
    this.dragonBody2 = this.add.image(0, 0, "dragon-body2").setOrigin(0.5, 0.5).setVisible(false);
    this.dragonBody1 = this.add.image(0, 0, "dragon-body1").setOrigin(0.5, 0.5).setVisible(false);
    this.wingLeft = this.add.image(0, 0, "dragon-wing").setOrigin(1, 0.5).setVisible(false);
    this.wingRight = this.add.image(0, 0, "dragon-wing").setOrigin(0, 0.5).setFlipX(true).setVisible(false);
    this.dragonHead = this.add.image(0, 0, "dragon-head").setOrigin(0.5, 0.6).setVisible(false);
    this.dragonParts = [
      this.dragonTail,
      this.dragonBody2,
      this.dragonBody1,
      this.wingLeft,
      this.wingRight,
      this.dragonHead,
    ];

    this.bars = this.add.graphics().setDepth(HUD_DEPTH);
    this.night = new Night(this, sconces().map((spot) => ({ ...spot, radius: 54, thaw: 0 })), NIGHT_BELOW);
    frameRoom(this, this.keeper);
    this.juice = new Juice(this, HUD_DEPTH);
    this.cursors = this.input.keyboard!.createCursorKeys();
    const add = this.input.keyboard!.addKey.bind(this.input.keyboard);
    this.keys = { a: add("A"), d: add("D"), w: add("W"), s: add("S"), shift: add("SHIFT") };
    this.events.on("wake", () => playMusic("lair"));
    playMusic("lair");
  }

  update(time: number, delta: number): void {
    const intent = this.intent();
    this.follow(intent, delta);
    const view = this.base ? replay(this.base, this.ahead, intent) : null;
    this.paint(view, time, delta);
    this.night.update(time, { x: this.keeper.x, y: this.keeper.y - 8, radius: 78, thaw: 0 });
    this.publish(intent);
  }

  private follow(intent: LairIntent, delta: number): void {
    const chain = readChainLair().lair;
    if (chain && chain.stepIndex !== this.seen) this.absorb(chain, intent);
    if (!chain) this.base = null;
    if (!this.base) return;
    this.acc += delta;
    while (this.acc >= STEP_MS && this.ahead < MAX_AHEAD) {
      this.acc -= STEP_MS;
      this.ahead += 1;
    }
  }

  private absorb(chain: Lair, intent: LairIntent): void {
    const predicted = this.base ? replay(this.base, this.ahead, intent) : null;
    const error = predicted ? Math.hypot(predicted.player.x - chain.player.x, predicted.player.y - chain.player.y) : 0;
    if (predicted && error > 8) log(`lair snap ${Math.round(error)} units`);
    this.base = cloneLair(chain);
    this.ahead = 0;
    this.acc = 0;
    this.seen = chain.stepIndex;
  }

  private paint(view: Lair | null, time: number, delta: number): void {
    showRoomNote(this.line(view), "");
    this.keeper.setVisible(Boolean(view));
    this.shadow.setVisible(Boolean(view));
    this.dragonParts.forEach((part) => part.setVisible(Boolean(view)));
    this.bars.clear();
    if (!view) {
      this.watch.reset();
      return;
    }

    if (view.player.attackCd > this.lastAttackCd) {
      playSfx("slash", 0.35);
      this.swingAt = time;
    }
    this.lastAttackCd = view.player.attackCd;

    this.drawLanterns(view.phase);
    const ease = Math.min(1, delta / 70);
    const moving = this.intentMoving();
    this.keeper.setPosition(glideX(this.keeper.x, ORIGIN_X + view.player.x, ease), glideY(this.keeper.y, ORIGIN_Y + view.player.y, ease));
    this.keeper.setFrame(keeperFrame(sheetColumn(view.player.facing), moving, time)).setDepth(this.keeper.y);
    this.keeper.setAlpha(view.player.invuln > 0 && Math.floor(time / 60) % 2 === 0 ? 0.4 : 1);
    this.shadow.setPosition(this.keeper.x, this.keeper.y + 1).setDepth(this.keeper.y - 0.5);

    this.paintDragon(view, time);
    this.blows(view, time);
    drawSwing(this.bars, this.keeper.x, this.keeper.y - 6, view.player.facing, time - this.swingAt);
    this.paintShots(view);
    this.paintSparks(view, time);
    this.bar(this.keeper.x - 12, this.keeper.y - 22, 24, view.player.hp / KEEPER_HP, 0xffbc75);
    if (view.marked) this.bars.fillStyle(0xffe18d, 0.95).fillCircle(this.keeper.x, this.keeper.y - 28, 3);
  }

  private paintDragon(view: Lair, time: number): void {
    const hx = ORIGIN_X + view.boss.x;
    const hy = ORIGIN_Y + view.boss.y;
    this.trail.unshift({ x: hx, y: hy });
    if (this.trail.length > 24) this.trail.pop();
    const p1 = this.trail[Math.min(5, this.trail.length - 1)] ?? { x: hx, y: hy };
    const p2 = this.trail[Math.min(10, this.trail.length - 1)] ?? p1;
    const pt = this.trail[Math.min(15, this.trail.length - 1)] ?? p2;

    const flap = Math.sin(time * (view.phase === 2 ? 0.025 : 0.012)) * 12;
    this.dragonHead.setPosition(hx, hy).setDepth(hy + 12);
    this.wingLeft.setPosition(p1.x - 10, p1.y - 8).setAngle(flap).setDepth(p1.y + 8);
    this.wingRight.setPosition(p1.x + 10, p1.y - 8).setAngle(-flap).setDepth(p1.y + 8);
    this.dragonBody1.setPosition(p1.x, p1.y - 10).setDepth(p1.y + 6);
    this.dragonBody2.setPosition(p2.x, p2.y - 16).setDepth(p2.y + 4);
    this.dragonTail.setPosition(pt.x, pt.y - 24).setDepth(pt.y + 2);

    const tint = view.telegraph > 0 ? 0xff9554 : view.phase === 2 ? 0xffe18d : 0xffffff;
    const flash = this.juice.flashing(this.dragonHead);
    this.dragonParts.forEach((part) => part.setTint(tint));
    // Only the head and chest flash: the whole rig going white would blank a third of the screen.
    if (flash) [this.dragonHead, this.dragonBody1].forEach((part) => part.setTintFill(0xffffff));
    if (view.telegraph > 0) this.warn(view, hx, hy, time);

    // Sunhoard ember in the belly socket: intensifies during Noon Unbound.
    const bellyAlpha = view.phase === 2 ? 0.92 : view.phase === 1 ? 0.2 : 0.42;
    const bellyRadius = view.phase === 2 ? 12 : 6;
    this.bars.fillStyle(0xffbc75, bellyAlpha).fillCircle(p1.x, p1.y - 10, bellyRadius);
    this.bars.fillStyle(0xffe18d, bellyAlpha).fillCircle(p2.x, p2.y - 16, bellyRadius * 0.8);
  }

  /** Where the telegraphed blow will land: the tail's sweep, the dash onto the keeper, or the head winding up. */
  private warn(view: Lair, hx: number, hy: number, time: number): void {
    const due = 1 - view.telegraph / TELEGRAPH_STEPS;
    if (view.attack === TAIL) drawDanger(this.bars, hx, hy, TAIL_REACH, due, time);
    else if (view.attack === DASH) drawDanger(this.bars, this.keeper.x, this.keeper.y - 4, DASH_REACH, due, time);
    else drawDanger(this.bars, hx, hy - 6, 14, due, time);
  }

  /** The keeper's own blows and hurts, shown as they land. Old Gloam's HP stays sealed: nothing here reads it. */
  private blows(view: Lair, time: number): void {
    const landed = this.watch.rise(BLOWS_KEY, view.hits, time);
    const dealt = this.watch.rise(DEALT_KEY, view.unflushed, time);
    if (landed > 0) {
      this.juice.hit(this.dragonHead, { fromX: this.keeper.x, fromY: this.keeper.y, amount: dealt, heavy: false });
    }
    const lost = this.watch.drop(KEEPER_KEY, view.player.hp, time);
    if (lost > 0) this.juice.hurt(this.keeper, lost);
  }

  private drawLanterns(phase: number): void {
    this.bars.lineStyle(1, phase === 2 ? 0xffe18d : 0xf2eaf1, 0.55);
    for (const [x, y] of LANTERNS) {
      this.bars.strokeCircle(ORIGIN_X + x, ORIGIN_Y + y, 36);
    }
  }

  private paintShots(view: Lair): void {
    for (const shot of view.shots) {
      if (shot.life <= 0) continue;
      const colour =
        shot.kind === 3 ? 0xdff4ff : shot.kind === 4 ? 0xff9554 : shot.kind === 5 ? 0x71ddee : 0xffe18d;
      this.bars.fillStyle(colour, 1);
      this.bars.fillCircle(ORIGIN_X + shot.x, ORIGIN_Y + shot.y, shot.kind === 3 ? 5 : 3);
    }
  }

  private paintSparks(view: Lair, time: number): void {
    for (const spark of view.sparks) {
      if (spark.life <= 0) continue;
      const pulse = Math.floor(time / 80) % 2 === 0;
      this.bars.fillStyle(pulse ? 0xffe18d : 0xffbc75, 1);
      this.bars.fillCircle(ORIGIN_X + spark.x, ORIGIN_Y + spark.y, 3);
    }
    const near = scoopable(view, view.player.x, view.player.y) >= 0;
    useHud.getState().setSparkNear(near);
  }

  private line(view: Lair | null): string {
    if (!view) return uiText("darkHatch");
    if (view.player.hp <= 0) return uiText("fell");
    const phase = view.phase === 0 ? uiText("phaseRime") : view.phase === 1 ? uiText("phaseGloaming") : uiText("phaseNoon");
    const state = view.marked ? `${phase} · ${uiText("glareMark")}` : phase;
    return view.hits > 0 ? `${state} · ${uiText("blowsLanded")}: ${view.hits}` : state;
  }

  private publish(intent: LairIntent): void {
    if (!readChainLair().lair) return;
    const key = `${intent.dx},${intent.dy},${intent.attack},${intent.dash}`;
    if (key === this.sent) return;
    this.sent = key;
    pushLairIntent(intent);
  }

  private intent(): LairIntent {
    if (textInput(document.activeElement)) return { dx: 0, dy: 0, attack: false, dash: false };
    let dx = 0;
    let dy = 0;
    if (pressed("left") || this.cursors.left?.isDown || this.keys.a.isDown) dx -= 1;
    if (pressed("right") || this.cursors.right?.isDown || this.keys.d.isDown) dx += 1;
    if (pressed("up") || this.cursors.up?.isDown || this.keys.w.isDown) dy -= 1;
    if (pressed("down") || this.cursors.down?.isDown || this.keys.s.isDown) dy += 1;
    return { dx, dy, attack: pressed("use") || Boolean(this.cursors.space?.isDown), dash: pressed("dash") || this.keys.shift.isDown };
  }

  private intentMoving(): boolean {
    return Boolean(this.cursors.left?.isDown || this.cursors.right?.isDown || this.cursors.up?.isDown || this.cursors.down?.isDown || this.keys.a.isDown || this.keys.d.isDown || this.keys.w.isDown || this.keys.s.isDown);
  }

  private bar(x: number, y: number, width: number, share: number, colour: number): void {
    const left = Math.round(x);
    const top = Math.round(y);
    this.bars.fillStyle(0x0e1419, 1).fillRect(left - 1, top - 1, width + 2, 5);
    this.bars.fillStyle(colour, 1).fillRect(left, top, Math.round(width * Math.max(0, Math.min(1, share))), 3);
  }
}

function replay(base: Lair, steps: number, intent: LairIntent): Lair {
  const next = cloneLair(base);
  const count = Math.max(0, Math.min(steps, 20));
  const pot = Number(useHud.getState().pot ?? 0n);
  for (let index = 0; index < count; index += 1) stepLair(next, intent, pot);
  return next;
}

function glideX(from: number, to: number, ease: number): number {
  return Math.abs(to - from) > 48 ? to : from + (to - from) * ease;
}

function glideY(from: number, to: number, ease: number): number {
  return Math.abs(to - from) > 48 ? to : from + (to - from) * ease;
}
