// What a blow looks like. Everything here is drawn on top of the fight and changes
// nothing in it: the step function and the chain never hear about any of this.
import type Phaser from "phaser";
import { playSfx } from "../../art/sound";
import { popNumber } from "./digits";
import { calmMotion } from "./frame";

const CHIP = "fight-chip";
const FLASH_MS = 90;
const HURT_MS = 130;
const KNOCK_PX = 5;
const PALE = 0xf2eaf1;
const GOLD = 0xffe18d;
const BLOOD = 0xef5a5a;
const GRAZE = 2;

type Mark = Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;

export interface Blow {
  /** Where the blow came from, to push the foe away from it. */
  fromX: number;
  fromY: number;
  amount: number;
  /** A heavier blow than usual: a bigger, golden number. */
  heavy: boolean;
}

export class Juice {
  private readonly chips: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly calm = calmMotion();
  private readonly flashes = new Map<Mark, number>();

  constructor(private readonly scene: Phaser.Scene, private readonly depth: number) {
    if (!scene.textures.exists(CHIP)) {
      const pen = scene.make.graphics({ x: 0, y: 0 }, false);
      pen.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 2);
      pen.generateTexture(CHIP, 2, 2);
      pen.destroy();
    }
    this.chips = scene.add.particles(0, 0, CHIP, {
      speed: { min: 30, max: 90 },
      lifespan: { min: 180, max: 340 },
      alpha: { start: 1, end: 0 },
      gravityY: 160,
      emitting: false,
    });
    this.chips.setDepth(depth);
  }

  /** A foe took a blow: white flash, a shove away from the keeper, a squash, chips and the number. */
  hit(mark: Mark, blow: Blow): void {
    this.flashes.set(mark, this.scene.time.now + FLASH_MS);
    // Clear of the HP bar the scene draws over the foe's head.
    const top = mark.y - mark.displayHeight * mark.originY - 15;
    const away = Math.atan2(mark.y - blow.fromY, mark.x - blow.fromX);
    // The scene eases the sprite back to where the fight says it stands, so the shove returns by itself.
    mark.setPosition(mark.x + Math.cos(away) * KNOCK_PX, mark.y + Math.sin(away) * KNOCK_PX);
    this.scene.tweens.killTweensOf(mark);
    mark.setScale(1.3, 0.72);
    this.scene.tweens.add({ targets: mark, scaleX: 1, scaleY: 1, duration: 150, ease: "Back.easeOut" });
    this.burst(mark.x, mark.y - 6, blow.heavy ? GOLD : PALE, blow.heavy ? 9 : 5);
    if (blow.amount > 0) popNumber(this.scene, mark.x, top, blow.amount, blow.heavy ? GOLD : PALE, blow.heavy, this.depth + 1);
    playSfx("hit", blow.heavy ? 0.4 : 0.28);
    this.shake(60, 0.003);
  }

  /** True while the mark should be drawn solid white. */
  flashing(mark: Mark): boolean {
    return (this.flashes.get(mark) ?? 0) > this.scene.time.now;
  }

  /** A foe fell: a white ghost of it swells and fades where it stood. */
  fell(mark: Phaser.GameObjects.Sprite): void {
    const ghost = this.scene.add.sprite(mark.x, mark.y, mark.texture.key, mark.frame.name);
    ghost.setOrigin(mark.originX, mark.originY).setDepth(this.depth - 1).setTintFill(0xffffff);
    this.scene.tweens.add({
      targets: ghost,
      scaleX: 1.9,
      scaleY: 1.9,
      alpha: 0,
      duration: 260,
      ease: "Cubic.easeOut",
      onComplete: () => ghost.destroy(),
    });
    this.burst(mark.x, mark.y - 6, PALE, 14);
    this.shake(110, 0.006);
  }

  /** The keeper was hurt: a red tint and the number lost; a real blow adds chips, a thud and a shake. */
  hurt(keeper: Phaser.GameObjects.Sprite, amount: number): void {
    keeper.setTint(BLOOD);
    this.scene.time.delayedCall(HURT_MS, () => keeper.clearTint());
    popNumber(this.scene, keeper.x, keeper.y - 30, amount, BLOOD, false, this.depth + 1);
    // The Gloaming's cold takes one HP at a time: no thud for that, or it never stops.
    if (amount <= GRAZE) return;
    this.burst(keeper.x, keeper.y - 6, BLOOD, 7);
    playSfx("hit", 0.45);
    this.shake(160, 0.009);
  }

  burst(x: number, y: number, colour: number, count: number): void {
    this.chips.setParticleTint(colour);
    this.chips.explode(count, x, y);
  }

  private shake(ms: number, strength: number): void {
    if (!this.calm) this.scene.cameras.main.shake(ms, strength, true);
  }
}
