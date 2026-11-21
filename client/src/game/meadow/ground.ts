// Paints the whole meadow floor once into one texture: the winter ground, and the
// thawed ground showing through an ordered dither wherever a lantern reaches.
import type Phaser from "phaser";
import type { Cell } from "./autotile";
import { COLS, MAP_H, MAP_W, ROWS, TILE } from "./layout";
import { thawed, type Light } from "./lights";
import type { Decal } from "./props";
import { pondTile, thawTile, winterTile } from "./tiles";

export const GROUND_KEY = "meadow-ground";

type Pick = (col: number, row: number) => Cell | null;

function layer(sheet: CanvasImageSource, picks: readonly Pick[]): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = MAP_W;
  canvas.height = MAP_H;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d canvas for the meadow floor");
  context.imageSmoothingEnabled = false;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      for (const pick of picks) {
        const cell = pick(col, row);
        if (cell) context.drawImage(sheet, cell[0] * TILE, cell[1] * TILE, TILE, TILE, col * TILE, row * TILE, TILE, TILE);
      }
    }
  }
  return context.getImageData(0, 0, MAP_W, MAP_H);
}

/** Copies thawed pixels over the winter ones: along the road and under every light. */
function melt(winter: ImageData, thaw: ImageData, lights: readonly Light[]): void {
  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      if (!thawed(x, y, lights)) continue;
      const at = (x + y * MAP_W) * 4;
      winter.data[at] = thaw.data[at];
      winter.data[at + 1] = thaw.data[at + 1];
      winter.data[at + 2] = thaw.data[at + 2];
    }
  }
}

const DETAIL_COLS = 16;

/** Stamps the ground scatter straight onto the floor, so it costs nothing to draw later. */
function scatter(context: CanvasRenderingContext2D, sheet: CanvasImageSource, decals: readonly Decal[]): void {
  for (const decal of decals) {
    const sx = (decal.frame % DETAIL_COLS) * TILE;
    const sy = Math.floor(decal.frame / DETAIL_COLS) * TILE;
    context.drawImage(sheet, sx, sy, TILE, TILE, decal.x - TILE / 2, decal.y - TILE / 2, TILE, TILE);
  }
}

export function paintGround(scene: Phaser.Scene, sheetKey: string, detailKey: string, lights: readonly Light[], decals: readonly Decal[]): void {
  const sheet = scene.textures.get(sheetKey).getSourceImage() as CanvasImageSource;
  const winter = layer(sheet, [winterTile, pondTile]);
  const thaw = layer(sheet, [thawTile]);
  melt(winter, thaw, lights);
  if (scene.textures.exists(GROUND_KEY)) scene.textures.remove(GROUND_KEY);
  const target = scene.textures.createCanvas(GROUND_KEY, MAP_W, MAP_H);
  if (!target) throw new Error("could not make the meadow floor texture");
  target.context.putImageData(winter, 0, 0);
  scatter(target.context, scene.textures.get(detailKey).getSourceImage() as CanvasImageSource, decals);
  target.refresh();
}
