// The camera-fixed sky strip (night gradient, stars, the black disc where noon
// should be, the aurora) and the falling snow. docs/ART.md "Sky strip and aurora band".
import Phaser from "phaser";

const SKY_KEY = "meadow-sky";
const BAND = 30;
const DEPTH = 5100;
const SNOW_DEPTH = 5200;
const FRAME_MS = 1000 / 12;
const STEPS = [0x141b1b, 0x3b3643, 0x4a5270];
const STARS: ReadonlyArray<readonly [number, number]> = [
  [14, 5],
  [47, 11],
  [92, 4],
  [131, 9],
  [176, 3],
  [214, 12],
  [262, 6],
  [305, 10],
  [347, 4],
  [391, 8],
  [423, 14],
  [470, 5],
];
const CURTAINS: ReadonlyArray<readonly [colour: number, speed: number, phase: number, reach: number]> = [
  [0x74a334, 0.0011, 0, 15],
  [0x71ddee, 0.0007, 2.1, 12],
  [0xa5608b, 0.0009, 4.4, 9],
];
const DISC_X = 452;
const DISC_Y = 12;

function css(colour: number, alpha: number): string {
  return `rgba(${(colour >> 16) & 255},${(colour >> 8) & 255},${colour & 255},${alpha})`;
}

/** Three flat tones stepped down the band, dithered where they meet and where the band ends. */
function paintBand(scene: Phaser.Scene, width: number): void {
  if (scene.textures.exists(SKY_KEY)) return;
  const texture = scene.textures.createCanvas(SKY_KEY, width, BAND);
  if (!texture) throw new Error("could not make the sky strip");
  const context = texture.context;
  for (let y = 0; y < BAND; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const depth = y / BAND + (((x + y) & 1) === 0 ? 0.06 : -0.06) + ((x & 3) === 0 && (y & 3) === 0 ? 0.05 : 0);
      if (depth > 0.94) continue;
      const tone = depth < 0.34 ? 0 : depth < 0.66 ? 1 : 2;
      context.fillStyle = css(STEPS[tone], 1);
      context.fillRect(x, y, 1, 1);
    }
  }
  texture.refresh();
}

export class Sky {
  private readonly strip: Phaser.GameObjects.Image;
  private readonly stars: Phaser.GameObjects.Graphics;
  private readonly aurora: Phaser.GameObjects.Graphics;
  private readonly snow: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly petals: Phaser.GameObjects.Particles.ParticleEmitter | null;
  private readonly width: number;
  private drawnAt = -FRAME_MS;
  private spring = false;

  constructor(scene: Phaser.Scene) {
    this.width = scene.scale.width;
    paintBand(scene, this.width);
    this.strip = scene.add.image(0, 0, SKY_KEY).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH);
    this.aurora = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.stars = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 2);
    this.snow = letItSnow(scene);
    this.petals = scene.textures.exists("petal") ? letPetalsFall(scene) : null;
  }

  setSpring(on: boolean): void {
    if (this.spring === on) return;
    this.spring = on;
    this.strip.setTint(on ? 0x79b8ce : 0xffffff);
    this.snow.emitting = !on;
    if (this.petals) this.petals.emitting = on;
  }

  update(time: number): void {
    if (time - this.drawnAt < FRAME_MS) return;
    this.drawnAt = time;
    this.drawAurora(time);
    this.drawStars(time);
  }

  private drawAurora(time: number): void {
    this.aurora.clear();
    if (this.spring) return;
    for (const [colour, speed, phase, reach] of CURTAINS) {
      this.aurora.fillStyle(colour, 0.34);
      for (let x = 0; x < this.width; x += 2) {
        const wave = Math.sin(x * 0.021 + time * speed + phase) + 0.6 * Math.sin(x * 0.057 - time * speed * 1.7 + phase);
        const height = Math.round(reach * (0.5 + 0.3 * wave));
        if (height > 1) this.aurora.fillRect(x, 1, 2, height);
      }
    }
  }

  private drawStars(time: number): void {
    this.stars.clear();
    if (this.spring) {
      this.stars.fillStyle(0xffe18d, 1);
      this.stars.fillCircle(DISC_X, DISC_Y, 7);
      this.stars.fillStyle(0xf2eaf1, 0.9);
      this.stars.fillCircle(DISC_X, DISC_Y, 4);
      return;
    }
    STARS.forEach(([x, y], index) => {
      const lit = Math.sin(time * 0.002 + index * 2.3) > -0.4;
      this.stars.fillStyle(index % 3 === 0 ? 0xffe18d : 0xf2eaf1, lit ? 1 : 0.35);
      this.stars.fillRect(x, y, 2, 2);
    });
    this.stars.fillStyle(0x141b1b, 1);
    this.stars.fillCircle(DISC_X, DISC_Y, 6);
    this.stars.lineStyle(1, 0xffe18d, 0.8);
    this.stars.strokeCircle(DISC_X, DISC_Y, 7);
  }
}

/** Snow over the whole screen: flakes are born anywhere on it, fade in, drift left and fade out. */
function letItSnow(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  const { width, height } = scene.scale;
  const flakes = scene.add.particles(0, 0, "snow", {
    frame: [0, 1, 2, 3, 4, 5, 6],
    emitZone: { type: "random", source: new Phaser.Geom.Rectangle(0, -24, width + 60, height + 24) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    lifespan: { min: 6000, max: 10000 },
    speedY: { min: 14, max: 30 },
    speedX: { min: -10, max: -4 },
    alpha: { onUpdate: (_particle: unknown, _key: string, t: number) => 0.9 * Math.min(1, t * 5, (1 - t) * 5) },
    frequency: 110,
    quantity: 1,
  });
  return flakes.setScrollFactor(0).setDepth(SNOW_DEPTH);
}

function letPetalsFall(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  const { width, height } = scene.scale;
  const petals = scene.add.particles(0, 0, "petal", {
    frame: [0, 1, 2, 3],
    emitZone: { type: "random", source: new Phaser.Geom.Rectangle(0, -24, width + 60, height + 24) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
    lifespan: { min: 6000, max: 10000 },
    speedY: { min: 10, max: 22 },
    speedX: { min: -12, max: 6 },
    alpha: { onUpdate: (_particle: unknown, _key: string, t: number) => 0.85 * Math.min(1, t * 5, (1 - t) * 5) },
    frequency: 160,
    quantity: 1,
    emitting: false,
  });
  return petals.setScrollFactor(0).setDepth(SNOW_DEPTH);
}
