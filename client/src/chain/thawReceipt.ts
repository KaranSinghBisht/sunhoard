// The receipt a reveal leaves in its own transaction: the key, the dust paid and the
// number of blocks. A shell that held only dust keeps no key in the pack, so this is
// the one place its key can be read.
import type { Program } from "@coral-xyz/anchor";
import type { Connection } from "@solana/web3.js";
import { asBytes, field } from "./bytes";
import { log } from "./log";

export interface ThawReceipt {
  /** Null on a refund, where the program publishes an all-zero key. */
  key: Uint8Array | null;
  dust: bigint;
  blocks: number;
  refund: bigint;
}

const TRIES = 5;
const WAIT_MS = 400;
const DATA = "Program data: ";

function asAmount(value: unknown): bigint {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function receiptIn(program: Program, logs: string[]): ThawReceipt | null {
  for (const line of logs) {
    if (!line.startsWith(DATA)) continue;
    const event = program.coder.events.decode(line.slice(DATA.length));
    if (!event || event.name.toLowerCase() !== "thawreceipt") continue;
    const data = event.data as Record<string, unknown>;
    const key = asBytes(field(data, "key"));
    const real = key && key.length === 32 && key.some((byte) => byte !== 0) ? key : null;
    return { key: real, dust: asAmount(field(data, "dust")), blocks: Number(field(data, "blocks") ?? 0), refund: asAmount(field(data, "refund")) };
  }
  return null;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Reads the `ThawReceipt` of one reveal. Null when the transaction or its logs cannot be read. */
export async function readThawReceipt(connection: Connection, program: Program, signature: string): Promise<ThawReceipt | null> {
  for (let attempt = 0; attempt < TRIES; attempt += 1) {
    try {
      const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      if (tx) return receiptIn(program, tx.meta?.logMessages ?? []);
    } catch (err) {
      log(`thaw receipt unavailable: ${err instanceof Error ? err.message.slice(0, 60) : "unknown"}`);
    }
    await pause(WAIT_MS);
  }
  return null;
}
