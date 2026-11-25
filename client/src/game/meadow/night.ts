// The night grade: one screen-size sheet multiplied over the world, with a stepped
// hole erased from it for every light, and a warm additive glow on top of each.
import Phaser from "phaser";
import type { Light } from "./lights";

/** Outdoors. Underground is colder and darker: pass NIGHT_BELOW. */
export const NIGHT_ABOVE = 0x8f9cd0;
export const NIGHT_BELOW = 0x6c78a8;
const WARM = 0xffbc75;
const MASK_KEY = "light-mask";
const MASK_SIZE = 64;
const SHADE_DEPTH = 5000;
const GLOW_DEPTH = 5001;
const GLOW_ALPHA = 0.22;
/** The keeper's own lamp is going out: it lifts the night by half, no more. */
const CARRIED_STRENGTH = 0.5;
/** Erase strengths that leave 75%, 40% and 0% of the night, ring by ring. */
const RINGS: ReadonlyArray<readonly [radius: number, alpha: number]> = [
  [32, 0.25],
  [25, 0.47],
  [17, 1],
];

function makeMask(scene: Phaser.Scene): void {
  if (scene.textures.exists(MASK_KEY)) return;
  const pen = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const [radius, alpha] of RINGS) {
    pen.fillStyle(0xffffff, alpha);
    pen.fillCircle(MASK_SIZE / 2, MASK_SIZE / 2, radius);
  }
  pen.generateTexture(MASK_KEY, MASK_SIZE, MASK_SIZE);
  pen.destroy();
}

export class Night {
  private readonly shade: Phaser.GameObjects.RenderTexture;
  private readonly stamp: Phaser.GameObjects.Image;
  private readonly glows: Phaser.GameObjects.Image[];
  private strength = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly lights: readonly Light[],
    private readonly colour: number = NIGHT_ABOVE,
  ) {
    makeMask(scene);
    const { width, height } = scene.scale;
    this.shade = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setScrollFactor(0);
    this.shade.setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(SHADE_DEPTH);
    this.stamp = scene.make.image({ key: MASK_KEY }, false).setOrigin(0.5, 0.5);
    this.glows = lights.map((light) => this.glow(light));
  }

  /** Scales the night shade (1 = Long Night, 0 = Spring daylight). */
  setStrength(value: number): void {
    this.strength = Math.max(0, Math.min(1, value));
    this.shade.setAlpha(this.strength);
  }

  private glow(light: Light): Phaser.GameObjects.Image {
    const image = this.scene.add.image(light.x, light.y, MASK_KEY).setDepth(GLOW_DEPTH);
    image.setBlendMode(Phaser.BlendModes.ADD).setTint(WARM).setAlpha(GLOW_ALPHA);
    return image.setScale((light.radius * 1.5) / MASK_SIZE);
  }

  /** Redraws the night for this frame. `carried` is the lamp the keeper holds. */
  update(time: number, carried: Light): void {
    const camera = this.scene.cameras.main;
    const { width, height } = this.scene.scale;
    this.shade.clear();
    if (this.strength <= 0.01) {
      this.glows.forEach((glow) => glow.setAlpha(0.05));
      return;
    }
    this.shade.fill(this.colour, 1);
    const all = [...this.lights, carried];
    all.forEach((light, index) => {
      const x = Math.round(light.x - camera.scrollX);
      const y = Math.round(light.y - camera.scrollY);
      const flicker = flickerOf(time, index);
      if (index < this.glows.length) this.glows[index].setAlpha((GLOW_ALPHA + flicker * 0.02) * this.strength);
      const radius = light.radius + flicker;
      if (x < -radius || y < -radius || x > width + radius || y > height + radius) return;
      this.stamp.setScale((radius * 2) / MASK_SIZE).setAlpha(index < this.lights.length ? 1 : CARRIED_STRENGTH);
      this.shade.erase(this.stamp, x, y);
    });
  }
}

/** A lamp's flame: two px in or out, about eight times a second, each lamp on its own beat. */
function flickerOf(time: number, index: number): number {
  const beat = Math.floor(time / 125) + index * 7;
  return ((Math.imul(beat, 2654435761) >>> 28) % 5) - 2;
}
