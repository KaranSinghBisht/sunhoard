import type Phaser from "phaser";
import { create } from "zustand";
import { clearLabels } from "./labels";

export type SceneKey = "overworld" | "cellar";

/** Which scene is on the canvas, for the overlays that only belong to one of them. */
export const useStage = create<{ scene: SceneKey }>(() => ({ scene: "overworld" }));

let game: Phaser.Game | null = null;

export function bindGame(next: Phaser.Game | null): void {
  game = next;
}

export function currentGame(): Phaser.Game | null {
  return game;
}

export function showScene(key: SceneKey): void {
  if (!game) return;
  useStage.setState({ scene: key });
  clearLabels();
  for (const scene of game.scene.scenes) {
    if (scene.scene.key !== key && scene.scene.isActive()) scene.scene.stop();
  }
  if (!game.scene.isActive(key)) game.scene.start(key);
}

let touring = true;

/** While the tale is open the meadow plays by itself: the camera drifts and the keys are ignored. */
export function setTouring(next: boolean): void {
  touring = next;
}

export function isTouring(): boolean {
  return touring;
}
