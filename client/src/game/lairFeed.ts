import type { Lair, LairIntent } from "../shared/lair";

let chain: Lair | null = null;
let waiting = false;
let sender: (intent: LairIntent) => void = () => undefined;
const listeners = new Set<(lair: Lair | null) => void>();

export function setChainLair(next: Lair | null, isWaiting: boolean): void {
  chain = next;
  waiting = isWaiting;
  for (const listener of listeners) listener(next);
}

export function readChainLair(): { lair: Lair | null; waiting: boolean } {
  return { lair: chain, waiting };
}

export function onLairChange(listener: (lair: Lair | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onLairIntent(next: (intent: LairIntent) => void): void {
  sender = next;
}

export function pushLairIntent(intent: LairIntent): void {
  sender(intent);
}
