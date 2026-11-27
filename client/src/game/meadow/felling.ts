// What a gather looks like on the meadow: the birch falls to a stump while the
// chain will not take another chop, grows back when it will, and each result
// floats up from the node as words.
import type Phaser from "phaser";
import { playSfx } from "../../art/sound";
import { useGather } from "../gatherState";
import { showPop } from "../labels";
import { USES } from "./uses";

const FALL_MS = 380;
const GROW_MS = 280;
const ROLL_DROP = 14;

export class Felling {
  private readonly stump?: Phaser.GameObjects.Image;
  private down = false;
  private seen: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly birch: Phaser.GameObjects.Image | undefined,
  ) {
    this.seen = useGather.getState().pop?.seq ?? 0;
    if (!birch) return;
    this.stump = scene.add.image(birch.x, birch.y, "nature", "stumpSmall").setOrigin(0.5, 1).setDepth(birch.depth).setVisible(false);
  }

  /** Called every frame with the camera's corner, so a result is drawn over its node. */
  sync(viewX: number, viewY: number): void {
    const { phase, node, pop } = useGather.getState();
    const resting = node === 0 && (phase === "roll" || phase === "rest");
    if (resting && !this.down) this.fell();
    if (!resting && this.down) this.regrow();
    if (!pop || pop.seq === this.seen) return;
    this.seen = pop.seq;
    const use = USES.find((entry) => entry.node === pop.node);
    // The roll often lands a moment after the yield, so its words start lower and the two never overlap.
    const drop = pop.tone === "gain" ? 0 : ROLL_DROP;
    if (use) showPop(pop.text, use.x - viewX, use.y - use.lift * 0.55 + drop - viewY, pop.tone);
    if (pop.tone === "bonus") playSfx("powerup");
  }

  private fell(): void {
    this.down = true;
    if (!this.birch) return;
    this.scene.tweens.killTweensOf(this.birch);
    this.scene.tweens.add({
      targets: this.birch,
      angle: 78,
      alpha: 0,
      duration: FALL_MS,
      ease: "Quad.easeIn",
      onComplete: () => this.stump?.setVisible(this.down),
    });
  }

  private regrow(): void {
    this.down = false;
    if (!this.birch) return;
    this.scene.tweens.killTweensOf(this.birch);
    this.stump?.setVisible(false);
    this.birch.setAngle(0).setAlpha(1).setScale(0.3);
    this.scene.tweens.add({ targets: this.birch, scale: 1, duration: GROW_MS, ease: "Back.easeOut" });
  }
}
