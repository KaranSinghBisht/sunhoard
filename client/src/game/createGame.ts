import Phaser from "phaser";
import { CellarScene } from "./CellarScene";
import { LairScene } from "./LairScene";
import { OverworldScene } from "./OverworldScene";
import { usePanel } from "../ui/panel";
import { textInput } from "./touch";

/**
 * Phaser captures W, A, S, D, Space and the arrows for the whole page, so a
 * text field would lose those letters and the keeper would walk while the
 * player types. The game's keyboard is off while a text field has focus or a
 * window is open over the game.
 */
function yieldKeys(game: Phaser.Game): void {
  const sync = (): void => {
    const keyboard = game.input?.keyboard;
    if (!keyboard) return;
    const on = !textInput(document.activeElement) && usePanel.getState().panel === null;
    if (keyboard.enabled === on) return;
    keyboard.enabled = on;
    // A key held across the change would never see its release, and the keeper would keep walking.
    for (const scene of game.scene.getScenes(true)) scene.input.keyboard?.resetKeys();
  };
  document.addEventListener("focusin", sync);
  document.addEventListener("focusout", sync);
  const unsubscribe = usePanel.subscribe(sync);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    document.removeEventListener("focusin", sync);
    document.removeEventListener("focusout", sync);
    unsubscribe();
  });
}

export function createGame(parent: HTMLElement, zoom: number): Phaser.Game {
  const game = buildGame(parent, zoom);
  yieldKeys(game);
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
