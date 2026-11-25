import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import type { TransactionInstruction } from "@solana/web3.js";
import { COMPUTE_UNITS } from "./config";
import { explorerUrl } from "./explorer";
import { uiText } from "../content/text";
import { playerMessage } from "./format";
import { log } from "./log";
import { useTxLog } from "./txlog";

export interface SendSigner {
  publicKey: PublicKey;
  sign(tx: Transaction): Promise<Transaction>;
}

const SEND_TRIES = 2;
const TIMEOUT_MS = 30_000;
/** A rollup confirms in tens of ms, so look often at first; a base-layer send settles into the slow poll. */
const FAST_POLLS = 40;
const FAST_POLL_MS = 25;
const SLOW_POLL_MS = 200;
/** The public devnet RPC refuses a burst of status calls, so a base-layer send never polls fast. */
const BASE_POLL_MS = 700;

export async function sendInstruction(
  connection: Connection,
  payer: SendSigner,
  extra: Keypair[],
  ix: TransactionInstruction,
  name: string,
  layer: "base" | "rollup",
  rollupEndpoint: string,
): Promise<string> {
  const started = performance.now();
  let signature = "";
  try {
    signature = await submit(connection, payer, extra, ix, layer);
    remember(name, signature, started, explorerUrl(signature, layer, rollupEndpoint), true);
    return signature;
  } catch (err) {
    const url = signature ? explorerUrl(signature, layer, rollupEndpoint) : "";
    remember(name, signature, started, url, false);
    // A settled error already holds a line fit for the player; do not re-read it as a wallet refusal.
    throw new Error(err instanceof SettledError ? err.message : playerMessage(err));
  }
}

class SettledError extends Error {}

/** The program's own words for a failed transaction, read from its logs; a plain line if there are none. */
async function refusal(connection: Connection, signature: string): Promise<string> {
  try {
    const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    for (const line of tx?.meta?.logMessages ?? []) {
      const said = /Error Message: (.+?)\.*$/.exec(line);
      if (said) return `${said[1]}.`;
    }
  } catch (err) {
    log(`no logs for a refused transaction: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`);
  }
  return uiText("refused");
}

async function submit(
  connection: Connection,
  payer: SendSigner,
  extra: Keypair[],
  ix: TransactionInstruction,
  layer: "base" | "rollup",
): Promise<string> {
  const signed = await signOnce(connection, payer, extra, ix);
  const raw = signed.tx.serialize();
  const signature = await sendRaw(connection, raw);
  await confirm(connection, signature, signed.lastValidBlockHeight, layer);
  return signature;
}

async function signOnce(
  connection: Connection,
  payer: SendSigner,
  extra: Keypair[],
  ix: TransactionInstruction,
): Promise<{ tx: Transaction; lastValidBlockHeight: number }> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }), ix);
  for (const signer of extra) tx.partialSign(signer);
  try {
    return { tx: await payer.sign(tx), lastValidBlockHeight };
  } catch (err) {
    throw new SettledError(playerMessage(err));
  }
}

async function sendRaw(connection: Connection, raw: Buffer): Promise<string> {
  let last = uiText("noAnswer");
  for (let attempt = 0; attempt <= SEND_TRIES; attempt += 1) {
    try {
      return await connection.sendRawTransaction(raw, { skipPreflight: true });
    } catch (err) {
      last = playerMessage(err);
    }
  }
  throw new Error(last);
}

async function confirm(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
  layer: "base" | "rollup",
): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let polls = 0;
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new SettledError(await refusal(connection, signature));
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    polls += 1;
    await delay(layer === "base" ? BASE_POLL_MS : polls <= FAST_POLLS ? FAST_POLL_MS : SLOW_POLL_MS);
  }
  const height = await connection.getBlockHeight();
  if (height > lastValidBlockHeight) throw new SettledError(uiText("expired"));
  throw new SettledError(uiText("pending"));
}

function remember(instruction: string, signature: string, started: number, url: string, ok: boolean): void {
  useTxLog.getState().add({
    instruction,
    signature,
    latencyMs: Math.round(performance.now() - started),
    url,
    ok,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
