import { connectionActive } from "./ownership";
import type { Connection, PublicKey } from "@solana/web3.js";
import type { LiveSession } from "./session";

export interface LivePlay {
  rollup: Connection;
  session: LiveSession;
  link: string;
  owner: PublicKey;
}

let live: LivePlay | null = null;

export function setLive(next: LivePlay | null): void {
  live = next;
}

export function getLive(): LivePlay | null {
  return live && connectionActive(live.rollup) ? live : null;
}
