import Phaser from "phaser";
import { CellarScene } from "./CellarScene";
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
    audio: { noAudio: true },
    scene: [OverworldScene, CellarScene],
    scale: { mode: Phaser.Scale.NONE },
  });
}
