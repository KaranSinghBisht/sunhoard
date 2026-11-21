// The trail a new Keeper follows: gold dots along the walkable way, and a marker bobbing over the goal.
import Phaser from "phaser";
import { routeTo, trail, type Point, type Route } from "./route";
import type { Solid } from "./solid";

const DEPTH = 5040;
const GOLD = 0xffe18d;
const INK = 0x141b1b;
const PALE = 0xf2eaf1;
const DOTS = 14;
const GAP = 12;
/** One dot in this many is lit at a time, and the lit one runs toward the goal. */
const RUN = 4;
const RUN_MS = 120;

export interface Goal {
  stand: Point;
  mark: Point;
}

export class Waymark {
  private readonly ink: Phaser.GameObjects.Graphics;
  private aimed: Point | null = null;
  private route: Route | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly solid: Solid,
  ) {
    this.ink = scene.add.graphics().setDepth(DEPTH);
  }

  /** Draws the way from (x,y) to `goal`. `near` hides it: the keeper is there and a hint tag has taken over. */
  update(time: number, x: number, y: number, goal: Goal | null, near: boolean): void {
    this.ink.clear();
    if (!goal) return;
    if (goal.stand !== this.aimed) {
      this.aimed = goal.stand;
      this.route = routeTo(this.solid, goal.stand.x, goal.stand.y);
    }
    if (near || !this.route) return;
    const beat = Math.floor(time / RUN_MS);
    trail(this.route, x, y, DOTS, GAP).forEach((dot, index) => this.dot(dot, (index - beat) % RUN === 0));
    this.marker(goal.mark, time);
  }

  private dot(at: Point, lit: boolean): void {
    this.ink.fillStyle(INK, 0.6).fillRect(at.x - 2, at.y - 2, 5, 5);
    this.ink.fillStyle(GOLD, lit ? 1 : 0.65).fillRect(at.x - 1, at.y - 1, 3, 3);
    if (lit) this.ink.fillStyle(PALE, 1).fillRect(at.x, at.y, 1, 1);
  }

  /** A small gold arrowhead pointing down at the goal. */
  private marker(at: Point, time: number): void {
    const y = at.y + Math.round(2 * Math.sin(time / 180));
    this.ink.fillStyle(INK, 1).fillTriangle(at.x - 6, y - 7, at.x + 6, y - 7, at.x, y + 1);
    this.ink.fillStyle(GOLD, 1).fillTriangle(at.x - 4, y - 6, at.x + 4, y - 6, at.x, y - 1);
  }
}
