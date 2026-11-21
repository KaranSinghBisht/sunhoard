import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { uiText } from "../content/text";
import { arenaInputIx, claimIx, crackIx, crackRevealIx, enterDungeonIx, exitDungeonIx, gatherIx, openProgram, postPositionIx } from "./program";
import { sendInstruction, type SendSigner } from "./send";

export function keypairSigner(signer: Keypair): SendSigner {
  return {
    publicKey: signer.publicKey,
    sign: async (tx) => {
      tx.partialSign(signer);
      return tx;
    },
  };
}

export async function postMove(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  x: number,
  y: number,
  facing: number,
): Promise<void> {
  const ix = await postPositionIx(openProgram(rollup), signer.publicKey, owner, sessionToken, x, y, facing);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "post_position", "rollup", linkEndpoint);
}

export async function chopTree(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  x: number,
  y: number,
): Promise<void> {
  const ix = await gatherIx(openProgram(rollup), signer.publicKey, owner, sessionToken, x, y);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "gather", "rollup", linkEndpoint);
}

export async function thawShell(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  slot: number,
): Promise<void> {
  const program = openProgram(rollup);
  const crack = await crackIx(program, signer.publicKey, owner, sessionToken, slot);
  await sendInstruction(rollup, keypairSigner(signer), [], crack, "crack", "rollup", linkEndpoint);
  await laterSlot(rollup);
  const reveal = await crackRevealIx(program, signer.publicKey, owner, sessionToken, slot);
  await sendInstruction(rollup, keypairSigner(signer), [], reveal, "crack_reveal", "rollup", linkEndpoint);
}

export async function enterRoom(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
): Promise<void> {
  const ix = await enterDungeonIx(openProgram(rollup), signer.publicKey, owner, sessionToken);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "enter_dungeon", "rollup", linkEndpoint);
}

export async function aimRoom(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  dx: number,
  dy: number,
  attack: number,
  dash: number,
): Promise<void> {
  const ix = await arenaInputIx(openProgram(rollup), signer.publicKey, owner, sessionToken, dx, dy, attack, dash);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "arena_input", "rollup", linkEndpoint);
}

export async function leaveRoom(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
): Promise<void> {
  const ix = await exitDungeonIx(openProgram(rollup), signer.publicKey, owner, sessionToken);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "exit_dungeon", "rollup", linkEndpoint);
}

export async function claimShare(connection: Connection, wallet: SendSigner): Promise<void> {
  const ix = await claimIx(openProgram(connection), wallet.publicKey);
  await sendInstruction(connection, wallet, [], ix, "claim", "base", "");
}

async function laterSlot(connection: Connection): Promise<void> {
  const start = await connection.getSlot("confirmed");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await connection.getSlot("confirmed")) > start) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(uiText("sealSlot"));
}
