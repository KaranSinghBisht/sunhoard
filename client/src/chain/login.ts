import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { requireCurrent } from "./ownership";
import { authToken } from "./auth";
import { DELEGATION_PROGRAM_ID, TEE_RPC } from "./config";
import { ownedPda } from "./pdas";
import { delegateHomeIx, delegatePlayerIx, joinIx, openProgram, signUpIx } from "./program";
import { rollupEndpoint } from "./explorer";
import { sendInstruction, type SendSigner } from "./send";

type MessageSigner = (message: Uint8Array) => Promise<Uint8Array>;

export async function enterMeadow(
  base: Connection,
  owner: PublicKey,
  wallet: SendSigner,
  signMessage: MessageSigner,
  linkEndpoint: string,
): Promise<string> {
  const program = openProgram(base);
  await ensureSignedUp(base, program, owner, wallet);
  await ensureDelegated(base, program, owner, wallet);
  requireCurrent(wallet.active?.() ?? true);
  const token = await authToken(owner, async (bytes) => {
    requireCurrent(wallet.active?.() ?? true);
    return signMessage(bytes);
  });
  requireCurrent(wallet.active?.() ?? true);
  const rollup = new Connection(rollupEndpoint(TEE_RPC, token), "confirmed");
  await ensureJoined(rollup, owner, wallet, linkEndpoint);
  return token;
}

async function ensureSignedUp(base: Connection, program: ReturnType<typeof openProgram>, owner: PublicKey, wallet: SendSigner) {
  const player = await base.getAccountInfo(ownedPda("player", owner));
  if (player) return;
  const ix = await signUpIx(program, owner);
  await sendInstruction(base, wallet, [], ix, "sign_up", "base", "");
}

async function ensureDelegated(base: Connection, program: ReturnType<typeof openProgram>, owner: PublicKey, wallet: SendSigner) {
  const player = await base.getAccountInfo(ownedPda("player", owner));
  const home = await base.getAccountInfo(ownedPda("village", owner));
  if (!player) throw new Error("Sign-up did not land.");
  if (!player.owner.equals(DELEGATION_PROGRAM_ID)) {
    await sendInstruction(base, wallet, [], await delegatePlayerIx(program, owner), "delegate_player", "base", "");
  }
  if (!home || !home.owner.equals(DELEGATION_PROGRAM_ID)) {
    await sendInstruction(base, wallet, [], await delegateHomeIx(program, owner), "delegate_home", "base", "");
  }
}

async function ensureJoined(rollup: Connection, owner: PublicKey, wallet: SendSigner, linkEndpoint: string) {
  const info = await rollup.getAccountInfo(ownedPda("player", owner));
  if (info && playerNumber(info.data) !== 0) return;
  const ix = await joinIx(openProgram(rollup), owner);
  await sendInstruction(rollup, wallet, [], ix, "join", "rollup", linkEndpoint);
}

function playerNumber(data: Uint8Array): number {
  if (data.length < 52) return 0;
  return data[48] + data[49] * 256 + data[50] * 65536 + data[51] * 16777216;
}

export function walletSigner(publicKey: PublicKey, signTransaction: (tx: Transaction) => Promise<Transaction>, active?: () => boolean): SendSigner {
  return { publicKey, sign: signTransaction, active };
}
