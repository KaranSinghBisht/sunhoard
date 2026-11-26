import { utils } from "@coral-xyz/anchor";
import { connectionActive, requireCurrent } from "./ownership";
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
  active?(): boolean;
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
  const active = () => connectionActive(connection) && (payer.active?.() ?? true);
  const check = () => requireCurrent(active());
  let row: number | undefined;
  const elapsed = () => Math.round(performance.now() - started);
  try {
    check();
    const signed = await signOnce(connection, payer, extra, ix, check);
    check();
    const raw = signed.tx.serialize();
    const signature = utils.bytes.bs58.encode(signed.tx.signature!);
    row = useTxLog.getState().add({
      instruction: name, signature, latencyMs: elapsed(), url: explorerUrl(signature, layer, rollupEndpoint),
      ok: false, status: "pending",
    });
    await sendRaw(connection, raw, check);
    await confirm(connection, signature, signed.lastValidBlockHeight, layer, check);
    check();
    useTxLog.getState().settle(row, "confirmed", elapsed());
    return signature;
  } catch (err) {
    if (active()) {
      if (row === undefined) {
        useTxLog.getState().add({ instruction: name, signature: "", latencyMs: elapsed(), url: "", ok: false });
      } else {
        // A timeout is not proof of failure, but the row must not sit pending for ever; the signature stays to check.
        useTxLog.getState().settle(row, "failed", elapsed());
      }
    }
    throw new Error(err instanceof SettledError ? err.message : playerMessage(err));
  }
}

class SettledError extends Error {}

const LOG_TRIES = 3;
const LOG_WAIT_MS = 400;
/** Anchor numbers a program's own errors from 6000; framework errors below that are not written for players. */
const OWN_ERRORS_FROM = 6000;

/** The program's own words for a failed transaction, read from its logs; a plain line if there are none. */
async function refusal(connection: Connection, signature: string): Promise<string> {
  for (let attempt = 0; attempt < LOG_TRIES; attempt += 1) {
    try {
      const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      const said = tx ? ownMessage(tx.meta?.logMessages ?? []) : null;
      if (said) return said;
      if (tx) break;
    } catch {
      log("Refusal logs unavailable");
    }
    await delay(LOG_WAIT_MS);
  }
  return uiText("refused");
}

function ownMessage(logs: string[]): string | null {
  for (const line of logs) {
    const said = /Error Number: (\d+)\. Error Message: (.+?)\.*$/.exec(line);
    if (said && Number(said[1]) >= OWN_ERRORS_FROM) return `${said[2]}.`;
  }
  return null;
}

async function signOnce(
  connection: Connection,
  payer: SendSigner,
  extra: Keypair[],
  ix: TransactionInstruction,
  check: () => void,
): Promise<{ tx: Transaction; lastValidBlockHeight: number }> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }), ix);
  for (const signer of extra) tx.partialSign(signer);
  try {
    check();
    return { tx: await payer.sign(tx), lastValidBlockHeight };
  } catch (err) {
    throw new SettledError(playerMessage(err));
  }
}

async function sendRaw(connection: Connection, raw: Buffer, check: () => void): Promise<string> {
  let last = uiText("noAnswer");
  for (let attempt = 0; attempt <= SEND_TRIES; attempt += 1) {
    check();
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
  check: () => void,
): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let polls = 0;
  while (Date.now() < deadline) {
    check();
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new SettledError(await refusal(connection, signature));
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    polls += 1;
    await delay(layer === "base" ? BASE_POLL_MS : polls <= FAST_POLLS ? FAST_POLL_MS : SLOW_POLL_MS);
  }
  const height = await connection.getBlockHeight();
  if (height > lastValidBlockHeight) throw new SettledError(uiText("expired"));
  throw new Error(uiText("pending"));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
