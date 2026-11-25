import Phaser from "phaser";
import { CellarScene } from "./CellarScene";
import { LairScene } from "./LairScene";
import { OverworldScene } from "./OverworldScene";

export function createGame(parent: HTMLElement, zoom: number): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 480,
    height: 270,
    zoom,
    pixelArt: true,
    roundPixels: true,
    banner: false,
    scene: [OverworldScene, CellarScene, LairScene],
    scale: { mode: Phaser.Scale.NONE },
  });
}
