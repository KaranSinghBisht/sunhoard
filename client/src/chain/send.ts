import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import type { TransactionInstruction } from "@solana/web3.js";
import { COMPUTE_UNITS } from "./config";
import { explorerUrl } from "./explorer";
import { uiText } from "../content/text";
import { playerMessage } from "./format";
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
    signature = await submit(connection, payer, extra, ix);
    remember(name, signature, started, explorerUrl(signature, layer, rollupEndpoint), true);
    return signature;
  } catch (err) {
    const url = signature ? explorerUrl(signature, layer, rollupEndpoint) : "";
    remember(name, signature, started, url, false);
    throw new Error(playerMessage(err));
  }
}

class SettledError extends Error {}

async function submit(
  connection: Connection,
  payer: SendSigner,
  extra: Keypair[],
  ix: TransactionInstruction,
): Promise<string> {
  const signed = await signOnce(connection, payer, extra, ix);
  const raw = signed.tx.serialize();
  const signature = await sendRaw(connection, raw);
  await confirm(connection, signature, signed.lastValidBlockHeight);
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

async function confirm(connection: Connection, signature: string, lastValidBlockHeight: number): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let polls = 0;
  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new SettledError(uiText("refused"));
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    polls += 1;
    await delay(polls <= FAST_POLLS ? FAST_POLL_MS : SLOW_POLL_MS);
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
