import type { Fight, Intent } from "../shared/fight";

let chain: Fight | null = null;
let waiting = false;
let sender: (intent: Intent) => void = () => undefined;

export function setChainFight(next: Fight | null, isWaiting: boolean): void {
  chain = next;
  waiting = isWaiting;
}

export function readChainFight(): { fight: Fight | null; waiting: boolean } {
  return { fight: chain, waiting };
}

export function onIntent(next: (intent: Intent) => void): void {
  sender = next;
}

export function pushIntent(intent: Intent): void {
  sender(intent);
}
