// Spots a number falling between two frames (a foe's HP, the keeper's HP), once per blow.
// The scene draws a predicted fight that snaps to the chain, so the same blow can show
// twice in a row; a short gap keeps one blow to one effect.
const GAP_MS = 220;

export class DropWatch {
  private readonly last = new Map<number, number>();
  private readonly shown = new Map<number, number>();

  /** How far `value` fell since the last frame, or 0 when it did not fall or was just shown. */
  drop(key: number, value: number, time: number): number {
    const before = this.last.get(key);
    this.last.set(key, value);
    if (before === undefined || value >= before) return 0;
    if (time - (this.shown.get(key) ?? -GAP_MS) < GAP_MS) return 0;
    this.shown.set(key, time);
    return before - value;
  }

  /** How far `value` rose since the last frame, deduped the same way (a hit counter). */
  rise(key: number, value: number, time: number): number {
    return this.drop(key, -value, time);
  }

  reset(): void {
    this.last.clear();
    this.shown.clear();
  }
}
