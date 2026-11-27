// One anvil strike from the hammer to the end of its roll. The strike only asks for
// randomness; a VRF callback decides hit or miss a moment later, so the page waits for
// the piece to stop forging before it says anything.
import type { Program } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import { usePack, type SlotView } from "../ui/pack";
import { strikeEnd, type StrikeEnd } from "../ui/roll/wheel";
import { asNumber, field } from "./bytes";
import type { LivePlay } from "./live";
import { log } from "./log";
import { connectionActive } from "./ownership";
import { ownedPda } from "./pdas";
import { strikeAnvil } from "./play";
import { openProgram } from "./program";
import { pullAccounts, pullPack } from "./watch";

/** The chain gives a roll up after 30 s (`PENDING_SECS` in instructions/anvil.rs:24). */
const ROLL_WAIT_MS = 30_000;
const ROLL_POLL_MS = 400;
/** `STRIKE_PENDING` in state/bits.rs:24. */
const STRIKE_PENDING = 1 << 0;

export interface StrikeOrder {
  item: SlotView;
  fodder: number[];
  /** Glints fed to the forge, in hundredths, as a decimal string. */
  glints: string;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** True while the strike's roll is still out; null when the player account cannot be read. */
async function strikePending(connection: Connection, program: Program, owner: PublicKey): Promise<boolean | null> {
  const info = await connection.getAccountInfo(ownedPda("player", owner));
  if (!info) return null;
  try {
    const player = program.coder.accounts.decode("player", info.data) as Record<string, unknown>;
    const flags = asNumber(field(player, "strikeFlags", "strike_flags"));
    return flags === null ? null : (flags & STRIKE_PENDING) !== 0;
  } catch (err) {
    log(`could not read the strike: ${err instanceof Error ? err.message.slice(0, 60) : "unknown"}`);
    return null;
  }
}

/** Asks until the callback has landed and the pack shows its result, or the chain's own wait has passed. */
async function rollLands(live: LivePlay, program: Program, item: SlotView): Promise<StrikeEnd> {
  const until = Date.now() + ROLL_WAIT_MS;
  while (Date.now() < until && connectionActive(live.rollup)) {
    if ((await strikePending(live.rollup, program, live.owner)) === false) {
      await pullPack(live.rollup, program, live.owner);
      const end = strikeEnd(item, usePack.getState().slots);
      if (end !== "pending") return end;
    }
    await pause(ROLL_POLL_MS);
  }
  return "pending";
}

/**
 * Sends the strike, then follows it to its result. Throws when the strike itself is
 * refused; resolves "pending" when the roll never came back. `onStruck` runs once the
 * strike has landed and only the roll is left.
 */
export async function strikeAndWait(live: LivePlay, order: StrikeOrder, onStruck: () => void): Promise<StrikeEnd> {
  const { rollup, session, owner, link } = live;
  await strikeAnvil(rollup, session.signer, owner, session.token, link, order.item.slot, order.fodder, order.glints);
  onStruck();
  const program = openProgram(rollup);
  const end = await rollLands(live, program, order.item);
  // The purse, the heat and the Sunhoard all moved with the roll.
  await pullAccounts(rollup, program, owner);
  return end;
}
