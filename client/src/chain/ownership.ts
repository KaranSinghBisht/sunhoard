// Base RPC clients can be shared. A private RPC connection belongs to exactly one live session.
import type { Connection } from "@solana/web3.js";
import { uiText } from "../content/text";

const owners = new WeakMap<Connection, () => boolean>();

export function scopeConnection(connection: Connection, active: () => boolean): void {
  owners.set(connection, active);
}

export function connectionActive(connection: Connection): boolean {
  return owners.get(connection)?.() ?? true;
}

export function requireCurrent(active: boolean): void {
  if (!active) throw new Error(uiText("sessionLost"));
}
