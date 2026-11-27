import { pressed, textInput } from "./touch";
import Phaser from "phaser";
import { playMusic, playSfx } from "../art/sound";
import { log } from "../chain/log";
import { uiText } from "../content/text";
import { cloneFight, replay, SHOT_WICK, type Fight, type Fighter, type Intent } from "../shared/fight";
import { insideHalfTile, positionError } from "../shared/predict";
import { ORIGIN_X, ORIGIN_Y, roomTiles, sconces, sheetColumn } from "./cellar/room";
import { Banner } from "./fight/banner";
import { drawDanger } from "./fight/danger";
import { requestRoomExit, roomExitReady } from "./fight/exit";
import { frameRoom } from "./fight/frame";
import { Juice } from "./fight/juice";
import { drawSwing } from "./fight/swing";
import { DropWatch } from "./fight/watch";
import { pushIntent, readChainFight } from "./fightFeed";
import { showRoomNote } from "./labels";
import { Night, NIGHT_BELOW } from "./meadow/night";
import { practising } from "./practice";
import { BAT, DUNGEON, KEEPER, MOUSE, SHADOW, SLIME, SPIRIT_IDLE, keeperFrame } from "./sheets";
import { tell } from "./story/tale";
import { useHud } from "../ui/store";

const STEP_MS = 100;
const MAX_AHEAD = 20;
const MAX_FOES = 8;
const FOE_KEYS = ["mouse", "slime", "bat", "spirit"];
const FOE_HP = [18, 40, 24, 900];
const KEEPER_HP = 100;
const HUD_DEPTH = 6000;
const LAST_ROOM = 6;
const BOSS_TELEGRAPH = 6;
/** The watch's key for the keeper; foes use their slot, 0–7. */
const KEEPER_KEY = -1;
/** A finished room waits this long before Space moves on, so the killing blow's key press cannot. */
const EXIT_WAIT_MS = 500;

/** After asking to leave, the keys stay off the wire this long: the fight they would steer is ending. */
const LEAVE_QUIET_MS = 2500;

interface Notice {
  title: string;
  hint: string;
  tone: "won" | "fell";
  /** True when the way out leaves the cellar, false when it opens the next room. */
  leaves: boolean;
}

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
  private swingAt = -1e9;
  private lightest = 0;
  private doneAt = 0;
  private exitHeld = false;
  private tapped = false;
  private quietUntil = 0;
  private readonly tap = (): void => {
    this.tapped = true;
  };
  private readonly watch = new DropWatch();
  private juice!: Juice;
  private banner!: Banner;
  private enter!: Phaser.Input.Keyboard.Key;
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
    this.swingAt = -1e9;
    this.doneAt = 0;
    this.tapped = false;
    this.quietUntil = 0;
    this.watch.reset();
    this.cameras.main.setBackgroundColor("#141b1b");
    for (const tile of roomTiles()) this.add.image(tile.x, tile.y, "dungeon", tile.frame).setDepth(0);
    this.shadow = this.add.image(0, 0, "shadow").setAlpha(0.4).setVisible(false);
    this.keeper = this.add.sprite(ORIGIN_X, ORIGIN_Y, "keeper", 0).setOrigin(0.5, 0.85).setVisible(false);
    // All 8 arena monster slots can render simultaneously (rooms 1-5 hold 5-7 foes).
    this.foes = Array.from({ length: MAX_FOES }, () =>
      this.add.sprite(0, 0, "mouse", 0).setOrigin(0.5, 0.85).setVisible(false),
    );
    this.bars = this.add.graphics().setDepth(HUD_DEPTH);
    this.night = new Night(this, sconces().map((spot) => ({ ...spot, radius: 54, thaw: 0 })), NIGHT_BELOW);
    if (!practising()) tell({ kind: "entered" });
    frameRoom(this, this.keeper);
    this.juice = new Juice(this, HUD_DEPTH);
    this.banner = new Banner(this.game.canvas.parentElement);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.banner.destroy());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.banner.destroy());
    this.cursors = this.input.keyboard!.createCursorKeys();
    const add = this.input.keyboard!.addKey.bind(this.input.keyboard);
    this.keys = { a: add("A"), d: add("D"), w: add("W"), s: add("S"), shift: add("SHIFT") };
    // Not captured: Enter on a focused page button must still press that button.
    this.enter = this.input.keyboard!.addKey("ENTER", false);
    for (const key of [this.cursors.space, this.enter]) key?.off("down", this.tap).on("down", this.tap);
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
    const notice = view ? this.notice(view) : null;
    showRoomNote(this.line(view, notice), practising() ? uiText("practice") : "");
    this.keeper.setVisible(Boolean(view));
    this.shadow.setVisible(Boolean(view));
    this.bars.clear();
    this.wayOut(notice, time);
    if (!view) {
      this.foes.forEach((mark) => mark.setVisible(false));
      this.watch.reset();
      this.lightest = 0;
      return;
    }
    if (view.player.attackCd > this.lastAttackCd) {
      playSfx("slash", 0.35);
      this.swingAt = time;
    }
    this.lastAttackCd = view.player.attackCd;
    const lost = this.watch.drop(KEEPER_KEY, view.player.hp, time);
    if (lost > 0) this.juice.hurt(this.keeper, lost);

    if (!practising() && readChainFight().fight && cleared(readChainFight().fight!)) tell({ kind: "cleared" });
    const ease = Math.min(1, delta / 70);
    const moving = intent.dx !== 0 || intent.dy !== 0;
    glide(this.keeper, view.player, ease);
    this.keeper.setFrame(keeperFrame(sheetColumn(view.player.facing), moving, time)).setDepth(this.keeper.y);
    this.keeper.setAlpha(view.player.invuln > 0 && Math.floor(time / 60) % 2 === 0 ? 0.4 : 1);
    this.shadow.setPosition(this.keeper.x, this.keeper.y + 1).setDepth(this.keeper.y - 0.5);
    drawSwing(this.bars, this.keeper.x, this.keeper.y - 6, view.player.facing, time - this.swingAt);
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
    const lost = foe ? this.watch.drop(index, foe.body.hp, time) : 0;
    if (lost > 0 && mark.visible) this.struck(mark, lost, alive);
    mark.setVisible(alive);
    if (!foe || !alive) return;
    glide(mark, foe.body, ease);
    const sprite = FOE_KEYS[foe.kind] ?? "bat";
    if (mark.texture.key !== sprite) mark.setTexture(sprite);
    const boss = foe.kind === 3;
    const flash = this.juice.flashing(mark);
    if (flash) mark.setTintFill(0xffffff);
    if (boss) {
      if (!flash) mark.setTint(view.bossTelegraph > 0 ? 0xff6a5a : 0x79b8ce);
      mark.setFrame(Math.floor(time / 160) % 5).setDepth(mark.y);
      this.drawSnufferHat(mark.x, mark.y - 38);
      if (view.bossTelegraph > 0) {
        drawDanger(this.bars, mark.x, mark.y - 16, 26, 1 - view.bossTelegraph / BOSS_TELEGRAPH, time);
      }
      this.bar(mark.x - 24, mark.y - 54, 48, foe.body.hp / FOE_HP[3], 0xef9597);
    } else {
      if (!flash) mark.setTint(0xffffff);
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

  /** A foe's HP fell by `lost`: the blow is shown, and its fall if that was the last of it. */
  private struck(mark: Phaser.GameObjects.Sprite, lost: number, alive: boolean): void {
    const heavy = this.lightest > 0 && lost > this.lightest * 1.3;
    this.lightest = this.lightest === 0 ? lost : Math.min(this.lightest, lost);
    if (!alive) this.juice.fell(mark);
    this.juice.hit(mark, { fromX: this.keeper.x, fromY: this.keeper.y, amount: lost, heavy });
  }

  /** What the banner says once the room is won or the keeper has fallen; null while the fight is on. */
  private notice(view: Fight): Notice | null {
    const won = cleared(view);
    if (!won && view.player.hp > 0) return null;
    const busy = useHud.getState().busy;
    if (!roomExitReady()) return { title: uiText(won ? "roomClear" : "fellTitle"), hint: uiText("roomFresh"), tone: won ? "won" : "fell", leaves: false };
    if (!won) return { title: uiText("fellTitle"), hint: uiText(busy ? "roomLeaving" : "fellHint"), tone: "fell", leaves: true };
    if (view.room < LAST_ROOM) return { title: uiText("roomClear"), hint: uiText(busy ? "roomOpening" : "roomNext"), tone: "won", leaves: false };
    return { title: uiText("cellarClear"), hint: uiText(busy ? "roomLeaving" : "roomLast"), tone: "won", leaves: true };
  }

  /** Shows the banner and lets a fresh press of Space or Enter take the way out the page's button offers. */
  private wayOut(notice: Notice | null, time: number): void {
    // Key-down events, not held keys: a tap shorter than a frame still counts, a key held through the kill does not.
    const touch = pressed("use");
    const fresh = this.tapped || (touch && !this.exitHeld);
    this.tapped = false;
    this.exitHeld = touch;
    if (!notice) {
      this.banner.hide();
      this.doneAt = 0;
      return;
    }
    this.banner.show(notice.title, notice.hint, notice.tone);
    if (this.doneAt === 0) {
      this.doneAt = time;
      if (notice.tone === "won") playSfx("powerup", 0.4);
    }
    // Only the chain's own word ends a room: the drawn fight runs a few steps ahead of it.
    const chain = readChainFight().fight;
    const sure = chain !== null && (cleared(chain) || chain.player.hp <= 0);
    if (!fresh || !sure || time - this.doneAt <= EXIT_WAIT_MS || useHud.getState().busy) return;
    // Leaving ends the fight on chain, so a key sent behind the exit would only come back as an error.
    if (notice.leaves) this.quietUntil = time + LEAVE_QUIET_MS;
    requestRoomExit();
  }

  private bar(x: number, y: number, width: number, share: number, colour: number): void {
    const left = Math.round(x);
    const top = Math.round(y);
    this.bars.fillStyle(0x141b1b, 1).fillRect(left - 1, top - 1, width + 2, 5);
    this.bars.fillStyle(colour, 1).fillRect(left, top, Math.round(width * Math.max(0, Math.min(1, share))), 3);
  }

  private line(view: Fight | null, notice: Notice | null): string {
    if (!view) return readChainFight().waiting ? uiText("sealing") : uiText("darkHatch");
    return notice ? notice.hint : uiText("fightHelp");
  }

  private publish(intent: Intent): void {
    if (!readChainFight().fight || this.time.now < this.quietUntil) return;
    const key = `${intent.dx},${intent.dy},${intent.attack},${intent.dash}`;
    if (key === this.sent) return;
    this.sent = key;
    pushIntent(intent);
  }

  private intent(): Intent {
    if (textInput(document.activeElement)) return { dx: 0, dy: 0, attack: false, dash: false };
    let dx = 0;
    let dy = 0;
    if (pressed("left") || this.cursors.left?.isDown || this.keys.a.isDown) dx -= 1;
    if (pressed("right") || this.cursors.right?.isDown || this.keys.d.isDown) dx += 1;
    if (pressed("up") || this.cursors.up?.isDown || this.keys.w.isDown) dy -= 1;
    if (pressed("down") || this.cursors.down?.isDown || this.keys.s.isDown) dy += 1;
    return { dx, dy, attack: pressed("use") || Boolean(this.cursors.space?.isDown), dash: pressed("dash") || this.keys.shift.isDown };
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
