import type { Fight, Intent } from "../shared/fight";

let chain: Fight | null = null;
let waiting = false;
let sender: (intent: Intent) => void = () => undefined;
const listeners = new Set<(fight: Fight | null) => void>();

export function setChainFight(next: Fight | null, isWaiting: boolean): void {
  chain = next;
  waiting = isWaiting;
  for (const listener of listeners) listener(next);
}

export function readChainFight(): { fight: Fight | null; waiting: boolean } {
  return { fight: chain, waiting };
}

export function onFightChange(listener: (fight: Fight | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onIntent(next: (intent: Intent) => void): void {
  sender = next;
}

export function pushIntent(intent: Intent): void {
  sender(intent);
}
