// Damage numbers drawn in the scene at the art's own pixel size, so they sit in the
// world with the sprites. Words still belong to the page (see game/labels.ts).
import type Phaser from "phaser";

const GLYPHS: Record<string, readonly string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};
const GLYPH_W = 3;
const GLYPH_H = 5;
const GAP = 1;
const INK = 0x141b1b;
const RISE_PX = 16;
const LIFE_MS = 620;

function stamp(pen: Phaser.GameObjects.Graphics, glyph: readonly string[], left: number, top: number): void {
  glyph.forEach((row, y) => {
    for (let x = 0; x < GLYPH_W; x += 1) if (row[x] === "1") pen.fillRect(left + x, top + y, 1, 1);
  });
}

function draw(pen: Phaser.GameObjects.Graphics, text: string, colour: number): void {
  const width = text.length * (GLYPH_W + GAP) - GAP;
  const left = -Math.floor(width / 2);
  // A one-pixel dark edge keeps the number readable over floor, foe and night alike.
  pen.fillStyle(INK, 1).fillRect(left - 1, -1, width + 2, GLYPH_H + 2);
  pen.fillStyle(colour, 1);
  [...text].forEach((char, index) => {
    const glyph = GLYPHS[char];
    if (glyph) stamp(pen, glyph, left + index * (GLYPH_W + GAP), 0);
  });
}

/** A number that floats up from (x, y) and fades. `big` doubles it, for a heavy blow. */
export function popNumber(scene: Phaser.Scene, x: number, y: number, value: number, colour: number, big: boolean, depth: number): void {
  const pen = scene.add.graphics().setDepth(depth).setPosition(Math.round(x), Math.round(y));
  draw(pen, String(Math.max(0, Math.round(value))), colour);
  if (big) pen.setScale(2);
  scene.tweens.add({
    targets: pen,
    y: pen.y - RISE_PX,
    duration: LIFE_MS,
    ease: "Cubic.easeOut",
    onComplete: () => pen.destroy(),
  });
  scene.tweens.add({ targets: pen, alpha: 0, delay: LIFE_MS * 0.6, duration: LIFE_MS * 0.4 });
}
