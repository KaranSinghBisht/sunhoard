// Decides what the meadow camera does: drift behind the title, glide through the opening, or follow the Keeper.
import Phaser from "phaser";
import { START_X, START_Y } from "../meadow/layout";
import { isTouring } from "../stage";
import { BEATS } from "./beats";
import { useTale } from "./tale";

/** tour: title card up · cinema: the opening is playing · talk: someone is speaking · play: the keys are the player's. */
export type Mode = "tour" | "cinema" | "talk" | "play";

/** Share of the remaining distance the camera covers each frame while it glides to a line's place. */
const GLIDE = 0.035;

function modeNow(): Mode {
  if (isTouring()) return "tour";
  const { beat, talk } = useTale.getState();
  if (beat !== null) return "cinema";
  return talk ? "talk" : "play";
}

function follows(mode: Mode): boolean {
  return mode === "talk" || mode === "play";
}

export class Director {
  private mode: Mode = "play";

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly keeper: Phaser.GameObjects.Sprite,
  ) {}

  update(time: number): Mode {
    const next = modeNow();
    if (follows(next) !== follows(this.mode)) {
      if (follows(next)) this.camera.startFollow(this.keeper, true, 0.14, 0.14, 0, 8);
      else this.camera.stopFollow();
    }
    this.mode = next;
    if (next === "tour") this.drift(time);
    if (next === "cinema") this.glide();
    return next;
  }

  private drift(time: number): void {
    this.camera.centerOn(START_X + 150 * Math.sin(time * 0.00017), START_Y - 16 + 70 * Math.sin(time * 0.00026));
  }

  private glide(): void {
    const beat = BEATS[useTale.getState().beat ?? 0];
    if (!beat) return;
    const view = this.camera.worldView;
    const x = view.centerX + (beat.x - view.centerX) * GLIDE;
    const y = view.centerY + (beat.y - view.centerY) * GLIDE;
    this.camera.centerOn(x, y);
  }
}
