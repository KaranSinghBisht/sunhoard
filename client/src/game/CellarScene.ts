import Phaser from "phaser";
import { playMusic, playSfx } from "../art/sound";
import { log } from "../chain/log";
import { uiText } from "../content/text";
import { cloneFight, replay, SHOT_WICK, type Fight, type Fighter, type Intent } from "../shared/fight";
import { insideHalfTile, positionError } from "../shared/predict";
import { ORIGIN_X, ORIGIN_Y, WORLD_H, WORLD_W, roomTiles, sconces, sheetColumn } from "./cellar/room";
import { pushIntent, readChainFight } from "./fightFeed";
import { showRoomNote } from "./labels";
import { Night, NIGHT_BELOW } from "./meadow/night";
import { practising } from "./practice";
import { BAT, DUNGEON, KEEPER, MOUSE, SHADOW, SLIME, SPIRIT_IDLE, keeperFrame } from "./sheets";
import { tell } from "./story/tale";

const STEP_MS = 100;
const MAX_AHEAD = 20;
const MAX_FOES = 8;
const FOE_KEYS = ["mouse", "slime", "bat", "spirit"];
const FOE_HP = [18, 40, 24, 900];
const KEEPER_HP = 100;
const HUD_DEPTH = 6000;

type Keys = Record<"a" | "d" | "w" | "s" | "shift", Phaser.Input.Keyboard.Key>;

export class CellarScene extends Phaser.Scene {
  private keeper!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private foes: Phaser.GameObjects.Sprite[] = [];
  private bars!: Phaser.GameObjects.Graphics;
  private night!: Night;
  private base: Fight | null = null;
  private ahead = 0;
  private seen = -1;
  private acc = 0;
  private samples = 0;
  private inside = 0;
  private lastAttackCd = 0;
  private lastKeeperHp = KEEPER_HP;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Keys;
  private sent = "";

  constructor() {
    super("cellar");
  }

  preload(): void {
    this.load.spritesheet("dungeon", DUNGEON, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("keeper", KEEPER, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("mouse", MOUSE, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("slime", SLIME, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("bat", BAT, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("spirit", SPIRIT_IDLE, { frameWidth: 50, frameHeight: 50 });
    this.load.image("shadow", SHADOW);
  }

  create(): void {
    this.base = null;
    this.seen = -1;
    this.sent = "";
    this.lastAttackCd = 0;
    this.lastKeeperHp = KEEPER_HP;
    this.cameras.main.setBackgroundColor("#141b1b").setBounds(0, 0, WORLD_W, WORLD_H);
    for (const tile of roomTiles()) this.add.image(tile.x, tile.y, "dungeon", tile.frame).setDepth(0);
    this.shadow = this.add.image(0, 0, "shadow").setAlpha(0.4).setVisible(false);
    this.keeper = this.add.sprite(ORIGIN_X, ORIGIN_Y, "keeper", 0).setOrigin(0.5, 0.85).setVisible(false);
    // All 8 arena monster slots can render simultaneously (rooms 1-5 hold 5-7 foes).
    this.foes = Array.from({ length: MAX_FOES }, () =>
      this.add.sprite(0, 0, "mouse", 0).setOrigin(0.5, 0.85).setVisible(false),
    );
    this.bars = this.add.graphics().setDepth(HUD_DEPTH);
    this.night = new Night(this, sconces().map((spot) => ({ ...spot, radius: 54, thaw: 0 })), NIGHT_BELOW);
    tell({ kind: "entered" });
    this.cameras.main.startFollow(this.keeper, true, 0.2, 0.2);
    this.cursors = this.input.keyboard!.createCursorKeys();
    const add = this.input.keyboard!.addKey.bind(this.input.keyboard);
    this.keys = { a: add("A"), d: add("D"), w: add("W"), s: add("S"), shift: add("SHIFT") };
    this.events.on("wake", () => playMusic("cellar"));
    playMusic("cellar");
  }

  update(time: number, delta: number): void {
    const intent = this.intent();
    this.follow(intent, delta);
    const view = this.base ? replay(this.base, this.ahead, intent) : null;
    this.paint(view, intent, time, delta);
    this.night.update(time, { x: this.keeper.x, y: this.keeper.y - 8, radius: 82, thaw: 0 });
    this.publish(intent);
  }

  private follow(intent: Intent, delta: number): void {
    const chain = readChainFight().fight;
    if (chain && chain.stepIndex !== this.seen) this.absorb(chain, intent);
    if (!chain) this.base = null;
    if (!this.base) return;
    this.acc += delta;
    while (this.acc >= STEP_MS && this.ahead < MAX_AHEAD) {
      this.acc -= STEP_MS;
      this.ahead += 1;
    }
  }

  private absorb(chain: Fight, intent: Intent): void {
    const predicted = this.base ? replay(this.base, this.ahead, intent) : chain;
    const error = this.base ? positionError(predicted, chain) : 0;
    if (this.base) this.note(error);
    this.base = !this.base || !insideHalfTile(error) ? cloneFight(chain) : blend(predicted, chain);
    this.ahead = 0;
    this.acc = 0;
    this.seen = chain.stepIndex;
  }

  private note(error: number): void {
    this.samples += 1;
    if (insideHalfTile(error)) this.inside += 1;
    if (this.samples % 100 === 0) log(`prediction ${this.inside}/${this.samples} frames inside half a tile`);
  }

  private paint(view: Fight | null, intent: Intent, time: number, delta: number): void {
    showRoomNote(this.line(view), practising() ? uiText("practice") : "");
    this.keeper.setVisible(Boolean(view));
    this.shadow.setVisible(Boolean(view));
    this.bars.clear();
    if (!view) {
      this.foes.forEach((mark) => mark.setVisible(false));
      return;
    }
    if (view.player.attackCd > this.lastAttackCd) playSfx("slash", 0.35);
    this.lastAttackCd = view.player.attackCd;
    if (view.player.hp < this.lastKeeperHp) playSfx("hit", 0.4);
    this.lastKeeperHp = view.player.hp;

    if (cleared(view)) tell({ kind: "cleared" });
    const ease = Math.min(1, delta / 70);
    const moving = intent.dx !== 0 || intent.dy !== 0;
    glide(this.keeper, view.player, ease);
    this.keeper.setFrame(keeperFrame(sheetColumn(view.player.facing), moving, time)).setDepth(this.keeper.y);
    this.keeper.setAlpha(view.player.invuln > 0 && Math.floor(time / 60) % 2 === 0 ? 0.4 : 1);
    this.shadow.setPosition(this.keeper.x, this.keeper.y + 1).setDepth(this.keeper.y - 0.5);
    this.swing(view.player);
    this.paintShots(view);
    this.foes.forEach((mark, index) => this.paintFoe(mark, view, index, time, ease));
    this.bar(this.keeper.x - 12, this.keeper.y - 22, 24, view.player.hp / KEEPER_HP, 0xffbc75);
  }

  private paintShots(view: Fight): void {
    for (const shot of view.shots) {
      if (shot.life <= 0) continue;
      this.bars.fillStyle(shot.kind === SHOT_WICK ? 0xf2eaf1 : 0xff9554, 1);
      this.bars.fillCircle(ORIGIN_X + shot.x, ORIGIN_Y + shot.y, shot.kind === SHOT_WICK ? 4 : 3);
    }
  }

  private paintFoe(mark: Phaser.GameObjects.Sprite, view: Fight, index: number, time: number, ease: number): void {
    const foe = view.foes[index];
    const alive = Boolean(foe && foe.body.hp > 0);
    mark.setVisible(alive);
    if (!foe || !alive) return;
    glide(mark, foe.body, ease);
    const sprite = FOE_KEYS[foe.kind] ?? "bat";
    if (mark.texture.key !== sprite) mark.setTexture(sprite);
    const boss = foe.kind === 3;
    if (boss) {
      mark.setScale(1);
      mark.setTint(view.bossTelegraph > 0 ? 0xff6a5a : 0x79b8ce);
      mark.setFrame(Math.floor(time / 160) % 5).setDepth(mark.y);
      this.drawSnufferHat(mark.x, mark.y - 38);
      if (view.bossTelegraph > 0) {
        this.bars.lineStyle(1, 0xe0394c, 0.8).strokeCircle(mark.x, mark.y - 16, 26);
      }
      this.bar(mark.x - 24, mark.y - 54, 48, foe.body.hp / FOE_HP[3], 0xef9597);
    } else {
      mark.setScale(1);
      mark.setTint(0xffffff);
      mark.setFrame((Math.floor(time / 160) % 4) * 4 + sheetColumn(foe.body.facing)).setDepth(mark.y);
      this.bar(mark.x - 8, mark.y - 20, 16, foe.body.hp / (FOE_HP[foe.kind] ?? 1), 0xef9597);
    }
  }

  /** Code-drawn candle-snuffer cone hat over GiantSpirit (docs/ART.md §6). */
  private drawSnufferHat(cx: number, topY: number): void {
    this.bars.fillStyle(0x4e484a, 1).fillRect(cx - 7, topY + 9, 14, 3);
    this.bars.fillStyle(0x8e7c73, 1).fillTriangle(cx - 6, topY + 9, cx + 6, topY + 9, cx, topY);
    this.bars.fillStyle(0xabc2bc, 1).fillRect(cx - 1, topY - 2, 2, 2);
  }

  private swing(player: Fighter): void {
    if (player.attackCd < 2) return;
    const turn = [0, 90, 180, 270][player.facing] ?? 0;
    this.bars.lineStyle(2, 0xf2eaf1, 0.9);
    this.bars.beginPath();
    this.bars.arc(this.keeper.x, this.keeper.y - 6, 16, Phaser.Math.DegToRad(turn - 45), Phaser.Math.DegToRad(turn + 45));
    this.bars.strokePath();
  }

  private bar(x: number, y: number, width: number, share: number, colour: number): void {
    const left = Math.round(x);
    const top = Math.round(y);
    this.bars.fillStyle(0x141b1b, 1).fillRect(left - 1, top - 1, width + 2, 5);
    this.bars.fillStyle(colour, 1).fillRect(left, top, Math.round(width * Math.max(0, Math.min(1, share))), 3);
  }

  private line(view: Fight | null): string {
    if (!view) return readChainFight().waiting ? uiText("sealing") : uiText("darkHatch");
    if (view.player.hp <= 0) return uiText("fell");
    if (cleared(view)) return uiText("roomClear");
    return uiText("fightHelp");
  }

  private publish(intent: Intent): void {
    if (!readChainFight().fight) return;
    const key = `${intent.dx},${intent.dy},${intent.attack},${intent.dash}`;
    if (key === this.sent) return;
    this.sent = key;
    pushIntent(intent);
  }

  private intent(): Intent {
    let dx = 0;
    let dy = 0;
    if (this.cursors.left?.isDown || this.keys.a.isDown) dx -= 1;
    if (this.cursors.right?.isDown || this.keys.d.isDown) dx += 1;
    if (this.cursors.up?.isDown || this.keys.w.isDown) dy -= 1;
    if (this.cursors.down?.isDown || this.keys.s.isDown) dy += 1;
    return { dx, dy, attack: Boolean(this.cursors.space?.isDown), dash: this.keys.shift.isDown };
  }
}

function cleared(view: Fight): boolean {
  return view.player.hp > 0 && view.foes.length > 0 && view.foes.every((foe) => foe.body.hp <= 0);
}

function glide(mark: Phaser.GameObjects.Sprite, body: Fighter, ease: number): void {
  const x = ORIGIN_X + body.x;
  const y = ORIGIN_Y + body.y;
  const far = Math.abs(x - mark.x) > 48 || Math.abs(y - mark.y) > 48;
  mark.setPosition(far ? x : mark.x + (x - mark.x) * ease, far ? y : mark.y + (y - mark.y) * ease);
}

function blend(predicted: Fight, chain: Fight): Fight {
  const next = cloneFight(chain);
  next.player.x = Math.round((predicted.player.x + chain.player.x) / 2);
  next.player.y = Math.round((predicted.player.y + chain.player.y) / 2);
  next.foes = chain.foes.map((foe, index) => {
    const local = predicted.foes[index];
    if (!local) return foe;
    return { ...foe, body: { ...foe.body, x: Math.round((local.body.x + foe.body.x) / 2), y: Math.round((local.body.y + foe.body.y) / 2) } };
  });
  return next;
}
