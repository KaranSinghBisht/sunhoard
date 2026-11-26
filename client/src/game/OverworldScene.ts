import { pressed, textInput } from "./touch";
import Phaser from "phaser";
import { playMusic, playSfx, unlockAudio } from "../art/sound";
import { getLive } from "../chain/live";
import { uiText } from "../content/text";
import { useHud } from "../ui/store";
import { useVillage } from "../ui/village";
import { useWorld } from "../ui/world";
import { gameBridge, knock } from "./bridge";
import { hideTag, showTag } from "./labels";
import { KINDS, SHEET_KEYS, type KindName } from "./meadow/cuts";
import { GROUND_KEY, paintGround } from "./meadow/ground";
import { MAP_H, MAP_W, START_X, START_Y } from "./meadow/layout";
import type { Light } from "./meadow/lights";
import { Night } from "./meadow/night";
import { meadow, type Meadow } from "./meadow/props";
import { FIRE_COL, FIRE_ROW, LAMPS, NELL_COL, NELL_ROW, footX, footY } from "./meadow/sites";
import { Sky } from "./meadow/sky";
import { useAt } from "./meadow/uses";
import { Waymark } from "./meadow/waymark";
import {
  CAMP,
  DETAIL,
  FIRE,
  FLOOR,
  HOUSE,
  KEEPER,
  NATURE,
  NELL,
  NELL_FACE,
  PETAL,
  RELIEF,
  SHADOW,
  SNOW,
  keeperColumn,
  keeperFrame,
} from "./sheets";
import { BEATS } from "./story/beats";
import { Director, type Mode } from "./story/director";
import { ARRIVE_X, ARRIVE_Y, EDGE_X } from "./story/quest";
import { currentStep, nextBeat, nextLine, speak, tell, useTale } from "./story/tale";

const SPEED = 80;
const REPORT_MS = 500;
const CARRIED_GLOW = 34;
const WALK_IN_SPEED = 44;
const RIGHT_COLUMN = 3;
const TONE_HEX = [0xe0394c, 0xf1c471, 0x79b8ce, 0xa5608b];
const SHEET_FILES: Record<(typeof SHEET_KEYS)[number], string> = { nature: NATURE, camp: CAMP, house: HOUSE, relief: RELIEF };

type Keys = Record<"a" | "d" | "w" | "s", Phaser.Input.Keyboard.Key>;

export class OverworldScene extends Phaser.Scene {
  private touched = false;
  private keeper!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private birch?: Phaser.GameObjects.Image;
  private land!: Meadow;
  private night!: Night;
  private sky!: Sky;
  private waymark!: Waymark;
  private director!: Director;
  private peers: Phaser.GameObjects.Sprite[] = [];
  private postGlows!: Phaser.GameObjects.Graphics;
  private springStrength = 1;
  private mode: Mode = "play";
  private arrivals = 0;
  private entering = false;
  private column = 0;
  private x = START_X;
  private y = START_Y;
  private facing = 1;
  private lastSent = 0;
  private sentX = -1;
  private sentY = -1;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Keys;

  constructor() {
    super("overworld");
  }

  preload(): void {
    this.load.spritesheet("floor", FLOOR, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("detail", DETAIL, { frameWidth: 16, frameHeight: 16 });
    for (const key of SHEET_KEYS) this.load.image(key, SHEET_FILES[key]);
    this.load.spritesheet("keeper", KEEPER, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("nell", NELL, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("snow", SNOW, { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet("fire", FIRE, { frameWidth: 12, frameHeight: 12 });
    this.load.spritesheet("petal", PETAL, { frameWidth: 8, frameHeight: 7 });
    this.load.image("shadow", SHADOW);
  }

  create(): void {
    this.land = meadow();
    this.cameras.main.setBackgroundColor("#f2eaf1");
    paintGround(this, "floor", "detail", this.land.lights, this.land.decals);
    this.add.image(0, 0, GROUND_KEY).setOrigin(0, 0).setDepth(0);
    this.cutKinds();
    this.placeProps();
    this.lightFire();
    this.standNell();
    this.shadow = this.add.image(this.x, this.y, "shadow").setAlpha(0.35);
    this.keeper = this.add.sprite(this.x, this.y, "keeper", 0).setOrigin(0.5, 0.85);
    this.peers = Array.from({ length: 12 }, () =>
      this.add.sprite(0, 0, "keeper", 0).setOrigin(0.5, 0.85).setTint(0xb8dce5).setVisible(false),
    );
    this.postGlows = this.add.graphics().setDepth(5002);
    this.night = new Night(this, this.land.lights);
    this.sky = new Sky(this);
    this.waymark = new Waymark(this, this.land.solid);
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.centerOn(this.x, this.y);
    this.cameras.main.startFollow(this.keeper, true, 0.14, 0.14, 0, 8);
    this.director = new Director(this.cameras.main, this.keeper);
    this.cursors = this.input.keyboard!.createCursorKeys();
    const add = this.input.keyboard!.addKey.bind(this.input.keyboard);
    this.keys = { a: add("A"), d: add("D"), w: add("W"), s: add("S") };
    this.input.keyboard!.on("keydown-SPACE", (event: KeyboardEvent) => this.act(event));
    this.input.keyboard!.on("keydown-ENTER", (event: KeyboardEvent) => this.act(event));
    this.input.keyboard!.on("keydown", () => unlockAudio());
    this.input.on("pointerdown", () => unlockAudio());
    this.events.on("wake", () => this.syncMusic());
    this.syncMusic();
  }

  update(time: number, delta: number): void {
    const using = pressed("use");
    if (using && !this.touched) this.act();
    this.touched = using;
    this.mode = this.director.update(time);
    this.arrive();
    const moving = this.mode === "play" ? this.step(delta) : this.walkIn(delta);
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const use = this.mode === "play" ? useAt(x, y) : undefined;
    const view = this.cameras.main.worldView;
    if (use) showTag(uiText(use.hint), use.x - view.x, use.y - use.lift - view.y);
    else hideTag();
    this.lead(time, x, y, Boolean(use));
    this.keeper.setPosition(x, y).setFrame(keeperFrame(this.column, moving, time)).setDepth(y);
    this.shadow.setPosition(x, y + 1).setDepth(y - 0.5);
    this.paintPeers(time);
    this.paintPostBlocks(time);
    this.updateSeasonLook(delta);
    this.night.update(time, this.carried(x, y));
    this.sky.update(time);
    this.report(time, x, y);
  }

  private syncMusic(): void {
    playMusic(useHud.getState().sunFree ? "spring" : "meadow");
  }

  private updateSeasonLook(delta: number): void {
    const sunFree = useHud.getState().sunFree;
    const target = sunFree ? 0 : 1;
    if (this.springStrength !== target) {
      const step = Math.min(1, delta / 2400);
      this.springStrength = sunFree
        ? Math.max(0, this.springStrength - step)
        : Math.min(1, this.springStrength + step);
      this.night.setStrength(this.springStrength);
    }
    this.sky.setSpring(sunFree);
    if (sunFree) playMusic("spring");
  }

  private paintPeers(time: number): void {
    const self = getLive()?.owner.toBase58() ?? "";
    const rows = useWorld
      .getState()
      .presence.filter((row) => row.player !== self && row.zone === 0 && row.x > 0 && row.y > 0);
    this.peers.forEach((sprite, index) => {
      const peer = rows[index];
      if (!peer) {
        sprite.setVisible(false);
        return;
      }
      sprite.setVisible(true);
      sprite.setPosition(peer.x, peer.y).setDepth(peer.y);
      const col = [1, 3, 0, 2][peer.facing] ?? 0;
      sprite.setFrame(keeperFrame(col, false, time));
    });
  }

  private paintPostBlocks(time: number): void {
    this.postGlows.clear();
    const posts = useVillage.getState().posts.filter((post) => post.hasBlock);
    const bob = Math.round(Math.sin(time / 350));
    posts.forEach((post, index) => {
      const spot = LAMPS[index % LAMPS.length];
      if (!spot) return;
      const px = footX(spot[0]) + 3;
      const py = footY(spot[1]) - 22 + bob;
      const color = TONE_HEX[post.tone] ?? TONE_HEX[0];
      this.postGlows.fillStyle(color, 0.35).fillCircle(px, py, 7 + post.grade * 2);
      this.postGlows.fillStyle(0x141b1b, 1).fillRect(px - 3, py - 3, 6, 6);
      this.postGlows.fillStyle(color, 1).fillRect(px - 2, py - 2, 4, 4);
    });
  }

  private report(time: number, x: number, y: number): void {
    if (time - this.lastSent < REPORT_MS) return;
    if (x === this.sentX && y === this.sentY) return;
    this.lastSent = time;
    this.sentX = x;
    this.sentY = y;
    gameBridge().move({ x, y, facing: this.facing });
  }

  private lead(time: number, x: number, y: number, near: boolean): void {
    const step = this.mode === "play" ? currentStep() : undefined;
    const goal = step?.stand && step.mark ? { stand: step.stand, mark: step.mark } : null;
    this.waymark.update(time, x, y, goal, near);
    if (this.mode === "play") tell({ kind: "at", x, y });
  }

  private arrive(): void {
    const { arrivals } = useTale.getState();
    if (arrivals === this.arrivals) return;
    this.arrivals = arrivals;
    this.entering = true;
    this.x = EDGE_X;
    this.y = ARRIVE_Y;
    this.column = RIGHT_COLUMN;
    this.facing = 1;
  }

  private walkIn(delta: number): boolean {
    const { beat } = useTale.getState();
    if (beat === null || !BEATS[beat]?.walkIn || this.x >= ARRIVE_X) return false;
    this.x = Math.min(ARRIVE_X, this.x + (WALK_IN_SPEED * Math.min(delta, 50)) / 1000);
    return true;
  }

  private carried(x: number, y: number): Light {
    return { x, y: y - 8, radius: CARRIED_GLOW, thaw: 0 };
  }

  private cutKinds(): void {
    for (const [name, cut] of Object.entries(KINDS)) {
      const texture = this.textures.get(cut.sheet);
      if (!texture.has(name)) texture.add(name, 0, cut.x, cut.y, cut.w, cut.h);
    }
  }

  private placeProps(): void {
    for (const prop of this.land.props) {
      const image = this.add.image(prop.x, prop.y, KINDS[prop.kind].sheet, prop.kind).setOrigin(0.5, 1).setDepth(prop.y);
      if (isBirch(prop.kind)) this.birch = image;
    }
  }

  private lightFire(): void {
    if (!this.anims.exists("fire")) {
      this.anims.create({ key: "fire", frames: this.anims.generateFrameNumbers("fire", { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
    }
    const y = footY(FIRE_ROW);
    this.add.sprite(footX(FIRE_COL), y - 14, "fire").setScale(1.5).setDepth(y + 0.1).play("fire");
  }

  private standNell(): void {
    const x = footX(NELL_COL);
    const y = footY(NELL_ROW);
    this.add.image(x, y + 1, "shadow").setAlpha(0.35).setDepth(y - 0.5);
    this.add.sprite(x, y, "nell", 3).setOrigin(0.5, 0.85).setDepth(y);
  }

  private step(delta: number): boolean {
    if (this.entering) {
      this.entering = false;
      this.x = Math.max(this.x, ARRIVE_X);
    }
    let dx = 0;
    let dy = 0;
    if (pressed("left") || this.cursors.left?.isDown || this.keys.a.isDown) dx -= 1;
    if (pressed("right") || this.cursors.right?.isDown || this.keys.d.isDown) dx += 1;
    if (pressed("up") || this.cursors.up?.isDown || this.keys.w.isDown) dy -= 1;
    if (pressed("down") || this.cursors.down?.isDown || this.keys.s.isDown) dy += 1;
    if (dx === 0 && dy === 0) return false;
    this.column = keeperColumn(dx, dy, this.column);
    this.facing = facingOf(dx, dy);
    const pace = (SPEED * Math.min(delta, 50)) / 1000 / Math.hypot(dx, dy);
    return this.slide(dx * pace, dy * pace);
  }

  private slide(dx: number, dy: number): boolean {
    const startX = this.x;
    const startY = this.y;
    const nextX = clamp(this.x + dx, 8, MAP_W - 8);
    if (!this.land.solid.blocks(nextX, this.y)) this.x = nextX;
    const nextY = clamp(this.y + dy, 12, MAP_H - 4);
    if (!this.land.solid.blocks(this.x, nextY)) this.y = nextY;
    return this.x !== startX || this.y !== startY;
  }

  private act(event?: KeyboardEvent): void {
    if (event?.repeat || textInput(event?.target ?? null) || this.mode === "tour") return;
    if (this.mode === "cinema") return nextBeat();
    if (this.mode === "talk") return nextLine();
    const use = useAt(Math.round(this.x), Math.round(this.y));
    if (use?.act === "door") knock();
    if (use?.act === "chop") this.gather(use.node ?? 0, use.x, use.y);
    if (use?.act === "talk") speak("nellName", NELL_FACE, ["nell1", "nell3"]);
  }

  private gather(node: number, nodeX: number, nodeY: number): void {
    if (node === 0 && this.birch) {
      this.tweens.add({ targets: this.birch, angle: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => this.birch?.setAngle(0) });
    }
    playSfx(node >= 1 && node <= 3 ? "mine" : "chop");
    gameBridge().chop({ x: Math.round(this.x), y: Math.round(this.y), nodeX, nodeY, node });
  }
}

function isBirch(kind: KindName): boolean {
  return kind === "birch";
}

function facingOf(dx: number, dy: number): number {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 3 : 1;
  return dy < 0 ? 0 : 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
