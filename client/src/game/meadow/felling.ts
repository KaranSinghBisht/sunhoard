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
/** How far above or below the tag a result starts, canvas px. */
const POP_GAP = 13;

/** How a mined-out rock, seam or bush looks until it can be worked again. */
const SPENT_SCALE = 0.6;
const SPENT_ALPHA = 0.45;

export class Felling {
  private readonly stump?: Phaser.GameObjects.Image;
  /** The node that is down right now, or null. */
  private down: number | null = null;
  private seen: number;

  /** `nodes` maps a gather node ID (0 birch, 1 rock, 2 coal, 3 ore, 4 berry) to its sprite. */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly nodes: Map<number, Phaser.GameObjects.Image>,
  ) {
    this.seen = useGather.getState().pop?.seq ?? 0;
    const birch = nodes.get(0);
    if (!birch) return;
    this.stump = scene.add.image(birch.x, birch.y, "nature", "stumpSmall").setOrigin(0.5, 1).setDepth(birch.depth).setVisible(false);
  }

  /** Called every frame with the camera's corner, so a result is drawn over its node. */
  sync(viewX: number, viewY: number): void {
    const { phase, node, pop } = useGather.getState();
    const resting = phase === "roll" || phase === "rest" ? node : null;
    if (resting !== this.down) {
      if (this.down !== null) this.regrow(this.down);
      if (resting !== null) this.fell(resting);
      this.down = resting;
    }
    if (!pop || pop.seq === this.seen) return;
    this.seen = pop.seq;
    const use = USES.find((entry) => entry.node === pop.node);
    // The yield rises from above the node's tag and the roll's result from below it, so the three never overlap.
    const offset = pop.tone === "gain" ? -POP_GAP : POP_GAP;
    if (use) showPop(pop.text, use.x - viewX, use.y - use.lift + offset - viewY, pop.tone);
    if (pop.tone === "bonus") playSfx("powerup");
  }

  /** The birch falls over and leaves a stump; anything else is worked down to a nub. */
  private fell(node: number): void {
    const sprite = this.nodes.get(node);
    if (!sprite) return;
    this.scene.tweens.killTweensOf(sprite);
    if (node !== 0) {
      this.scene.tweens.add({ targets: sprite, scale: SPENT_SCALE, alpha: SPENT_ALPHA, duration: FALL_MS / 2, ease: "Quad.easeOut" });
      return;
    }
    this.scene.tweens.add({
      targets: sprite,
      angle: 78,
      alpha: 0,
      duration: FALL_MS,
      ease: "Quad.easeIn",
      onComplete: () => this.stump?.setVisible(this.down === 0),
    });
  }

  private regrow(node: number): void {
    const sprite = this.nodes.get(node);
    if (!sprite) return;
    this.scene.tweens.killTweensOf(sprite);
    if (node === 0) this.stump?.setVisible(false);
    sprite.setAngle(0).setAlpha(1).setScale(0.3);
    this.scene.tweens.add({ targets: sprite, scale: 1, duration: GROW_MS, ease: "Back.easeOut" });
  }
}
