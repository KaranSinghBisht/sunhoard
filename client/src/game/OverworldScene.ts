import Phaser from "phaser";
import { uiText } from "../content/text";
import { gameBridge, knock } from "./bridge";
import { hideTag, showTag } from "./labels";
import { KINDS, SHEET_KEYS, type KindName } from "./meadow/cuts";
import { GROUND_KEY, paintGround } from "./meadow/ground";
import { MAP_H, MAP_W, START_X, START_Y, TREE_X, TREE_Y } from "./meadow/layout";
import type { Light } from "./meadow/lights";
import { Night } from "./meadow/night";
import { meadow, type Meadow } from "./meadow/props";
import { FIRE_COL, FIRE_ROW, NELL_COL, NELL_ROW, footX, footY } from "./meadow/sites";
import { Sky } from "./meadow/sky";
import { useAt } from "./meadow/uses";
import { Waymark } from "./meadow/waymark";
import { CAMP, DETAIL, FIRE, FLOOR, HOUSE, KEEPER, NATURE, NELL, NELL_FACE, RELIEF, SHADOW, SNOW, keeperColumn, keeperFrame } from "./sheets";
import { BEATS } from "./story/beats";
import { Director, type Mode } from "./story/director";
import { ARRIVE_X, ARRIVE_Y, EDGE_X } from "./story/quest";
import { currentStep, nextBeat, nextLine, speak, tell, useTale } from "./story/tale";

const SPEED = 80;
const REPORT_MS = 500;
const CARRIED_GLOW = 34;
/** The Keeper comes up the road at a tired walk during the opening. */
const WALK_IN_SPEED = 44;
const RIGHT_COLUMN = 3;
const SHEET_FILES: Record<(typeof SHEET_KEYS)[number], string> = { nature: NATURE, camp: CAMP, house: HOUSE, relief: RELIEF };

type Keys = Record<"a" | "d" | "w" | "s", Phaser.Input.Keyboard.Key>;

export class OverworldScene extends Phaser.Scene {
  private keeper!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private birch?: Phaser.GameObjects.Image;
  private land!: Meadow;
  private night!: Night;
  private sky!: Sky;
  private waymark!: Waymark;
  private director!: Director;
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
  }

  update(time: number, delta: number): void {
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
    this.night.update(time, this.carried(x, y));
    this.sky.update(time);
    this.report(time, x, y);
  }

  /** Tells the chain layer where the keeper is, at most twice a second and only after a move. */
  private report(time: number, x: number, y: number): void {
    if (time - this.lastSent < REPORT_MS) return;
    if (x === this.sentX && y === this.sentY) return;
    this.lastSent = time;
    this.sentX = x;
    this.sentY = y;
    gameBridge().move({ x, y, facing: this.facing });
  }

  /** Draws the first-night trail to the current step, and tells the walk where the Keeper is. */
  private lead(time: number, x: number, y: number, near: boolean): void {
    const step = this.mode === "play" ? currentStep() : undefined;
    const goal = step?.stand && step.mark ? { stand: step.stand, mark: step.mark } : null;
    this.waymark.update(time, x, y, goal, near);
    if (this.mode === "play") tell({ kind: "at", x, y });
  }

  /** Each time the opening starts, the Keeper is put back at the west end of the road. */
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

  /** During the opening's last line the Keeper walks in along the road. */
  private walkIn(delta: number): boolean {
    const { beat } = useTale.getState();
    if (beat === null || !BEATS[beat]?.walkIn || this.x >= ARRIVE_X) return false;
    this.x = Math.min(ARRIVE_X, this.x + (WALK_IN_SPEED * Math.min(delta, 50)) / 1000);
    return true;
  }

  private carried(x: number, y: number): Light {
    return { x, y: y - 8, radius: CARRIED_GLOW, thaw: 0 };
  }

  /** Names one frame per sprite kind on its sheet, so a prop is drawn whole. */
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
      // The opening was skipped or has ended: the Keeper is on the road, wherever the walk-in got to.
      this.entering = false;
      this.x = Math.max(this.x, ARRIVE_X);
    }
    let dx = 0;
    let dy = 0;
    if (this.cursors.left?.isDown || this.keys.a.isDown) dx -= 1;
    if (this.cursors.right?.isDown || this.keys.d.isDown) dx += 1;
    if (this.cursors.up?.isDown || this.keys.w.isDown) dy -= 1;
    if (this.cursors.down?.isDown || this.keys.s.isDown) dy += 1;
    if (dx === 0 && dy === 0) return false;
    this.column = keeperColumn(dx, dy, this.column);
    this.facing = facingOf(dx, dy);
    const pace = (SPEED * Math.min(delta, 50)) / 1000 / Math.hypot(dx, dy);
    return this.slide(dx * pace, dy * pace);
  }

  /** Moves one axis at a time, so the keeper slides along a wall instead of sticking to it. */
  private slide(dx: number, dy: number): boolean {
    const startX = this.x;
    const startY = this.y;
    const nextX = clamp(this.x + dx, 8, MAP_W - 8);
    if (!this.land.solid.blocks(nextX, this.y)) this.x = nextX;
    const nextY = clamp(this.y + dy, 12, MAP_H - 4);
    if (!this.land.solid.blocks(this.x, nextY)) this.y = nextY;
    return this.x !== startX || this.y !== startY;
  }

  /** Space or Enter: the next line while someone is talking, else whatever is in reach. */
  private act(event: KeyboardEvent): void {
    if (event.repeat || this.mode === "tour") return;
    if (this.mode === "cinema") return nextBeat();
    if (this.mode === "talk") return nextLine();
    const use = useAt(Math.round(this.x), Math.round(this.y));
    if (use?.act === "door") knock();
    if (use?.act === "chop") this.chop();
    if (use?.act === "talk") speak("nellName", NELL_FACE, ["nell1", "nell3"]);
  }

  private chop(): void {
    if (this.birch) {
      this.tweens.add({ targets: this.birch, angle: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => this.birch?.setAngle(0) });
    }
    gameBridge().chop({ x: Math.round(this.x), y: Math.round(this.y), nodeX: TREE_X, nodeY: TREE_Y });
    tell({ kind: "chopped" });
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
