// The way out of a cleared room: the scene asks, whoever owns the dungeon flow answers.
// The page's button owns the transaction; the scene only says "the player pressed Space".
let handler: (() => void) | null = null;

/** `null` hands it back, and asking then does nothing (the practice room has no exit). */
export function onRoomExit(next: (() => void) | null): void {
  handler = next;
}

export function requestRoomExit(): void {
  handler?.();
}

/** True when something would answer: the hint only promises a key that works. */
export function roomExitReady(): boolean {
  return handler !== null;
}
