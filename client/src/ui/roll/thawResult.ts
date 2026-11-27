// What one thaw produced, put together from what the chain wrote: the receipt the reveal
// emitted, the blocks that appeared in the pack, and the key the program published.
import { sha256 } from "../../shared/sha";
import { sealMatches } from "../../shared/seal";
import type { SlotView } from "../pack";
import { rollShell, type Rolled, type RolledGem } from "./thawOdds";

/** The `ThawReceipt` event of `crack_reveal` (instructions/crack.rs:58), as far as the page uses it. */
export interface ReceiptView {
  key: Uint8Array | null;
  dust: bigint;
  blocks: number;
  refund: bigint;
}

export type ThawKind = "blocks" | "dust" | "refund" | "unknown";

export interface ThawResult {
  shell: number;
  kind: ThawKind;
  /** The blocks the chain put in the pack, in the order the program rolled them when that is known. */
  blocks: SlotView[];
  /** Frost dust paid in Glint hundredths, when the chain said how much. */
  dust: bigint | null;
  /** The key's rolls, only when they reproduce exactly what the chain wrote. */
  rolled: Rolled | null;
  /** The commitment the page showed before the fee was paid. */
  seal: Uint8Array;
  /** sha256 of the revealed key, or null when no key could be read. */
  keyHash: Uint8Array | null;
  sealOk: boolean;
}

export interface ThawInput {
  shell: number;
  seal: Uint8Array;
  receipt: ReceiptView | null;
  /** The key kept in the block's own slot, for when the receipt cannot be read. */
  slotKey: Uint8Array | null;
  /** Blocks in the pack now that were not there before the thaw. */
  fresh: SlotView[];
  /** The shell is no longer in the pack. */
  shellGone: boolean;
  /** What the reveal added to the purse, read from the chain before and after it; null when it was not read. */
  purseGain?: bigint | null;
}

function sameGem(gem: RolledGem, block: SlotView): boolean {
  return gem.tone === block.tone && gem.grade === block.grade && gem.purityBp === block.purityBp && gem.pattern === block.pattern;
}

/** The pack's new blocks in the order the key rolled them; null when they are not the same blocks. */
function inRollOrder(gems: RolledGem[], fresh: SlotView[]): SlotView[] | null {
  if (gems.length !== fresh.length) return null;
  const left = [...fresh];
  const out: SlotView[] = [];
  for (const gem of gems) {
    const at = left.findIndex((block) => sameGem(gem, block));
    if (at < 0) return null;
    out.push(...left.splice(at, 1));
  }
  return out;
}

function kindOf(input: ThawInput): ThawKind {
  if (input.fresh.length > 0) return "blocks";
  if (input.receipt && input.receipt.refund > 0n) return "refund";
  if (input.receipt ? input.receipt.dust > 0n : input.shellGone) return "dust";
  return "unknown";
}

/** The rolls agree with the chain when they give the same blocks and the same dust. */
function agreed(rolled: Rolled | null, input: ThawInput, kind: ThawKind): SlotView[] | null {
  if (!rolled || kind === "refund" || kind === "unknown") return null;
  if ((rolled.dust > 0) !== (kind === "dust")) return null;
  if (input.receipt && input.receipt.dust !== BigInt(rolled.dust)) return null;
  return inRollOrder(rolled.gems, input.fresh);
}

/** The dust paid: the receipt's figure, else the key's when it agrees with the chain, else what the purse gained. */
function dustPaid(input: ThawInput, kind: ThawKind, rolled: Rolled | null): bigint | null {
  if (input.receipt) return input.receipt.dust;
  if (rolled) return BigInt(rolled.dust);
  const gain = input.purseGain ?? null;
  return kind === "dust" && gain !== null && gain > 0n ? gain : null;
}

export function settleThaw(input: ThawInput): ThawResult {
  const key = input.receipt?.key ?? input.slotKey;
  const kind = kindOf(input);
  const rolled = key ? rollShell(key, input.shell) : null;
  const ordered = agreed(rolled, input, kind);
  const known = ordered !== null && rolled !== null;
  return {
    shell: input.shell,
    kind,
    blocks: ordered ?? input.fresh,
    dust: dustPaid(input, kind, known ? rolled : null),
    rolled: known ? rolled : null,
    seal: input.seal,
    keyHash: key ? sha256(key) : null,
    sealOk: key !== null && sealMatches(key, input.seal),
  };
}

/** "3fa9c2d1…77e0c21b": enough of 32 bytes to compare two by eye. */
export function shortHex(bytes: Uint8Array, each = 4): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.length <= each * 4 ? hex : `${hex.slice(0, each * 2)}…${hex.slice(-each * 2)}`;
}
