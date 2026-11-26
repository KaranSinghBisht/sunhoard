import Phaser from "phaser";
import { CellarScene } from "./CellarScene";
import { LairScene } from "./LairScene";
import { OverworldScene } from "./OverworldScene";
import { textInput } from "./touch";

/**
 * Phaser captures W, A, S, D, Space and the arrows for the whole page, so a
 * text field would lose those letters and the keeper would walk while the
 * player types. While a text field has focus the game's keyboard is off.
 */
function yieldKeysToTextFields(game: Phaser.Game): void {
  const sync = (): void => {
    const keyboard = game.input?.keyboard;
    if (keyboard) keyboard.enabled = !textInput(document.activeElement);
  };
  document.addEventListener("focusin", sync);
  document.addEventListener("focusout", sync);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    document.removeEventListener("focusin", sync);
    document.removeEventListener("focusout", sync);
  });
}

export function createGame(parent: HTMLElement, zoom: number): Phaser.Game {
  const game = buildGame(parent, zoom);
  yieldKeysToTextFields(game);
  return game;
}

function buildGame(parent: HTMLElement, zoom: number): Phaser.Game {
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
