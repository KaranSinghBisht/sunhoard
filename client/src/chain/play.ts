import { Connection, Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { uiText } from "../content/text";
import {
  arenaInputIx,
  buyIx,
  cancelIx,
  catchSparkIx,
  claimIx,
  collectIx,
  crackIx,
  crackRevealIx,
  craftIx,
  eatIx,
  enterDungeonIx,
  enterLairIx,
  equipIx,
  exitDungeonIx,
  exitLairIx,
  feedIx,
  gatherIx,
  lairInputIx,
  listIx,
  merchantBuyIx,
  merchantSellIx,
  nameWyrmIx,
  nextRoomIx,
  openProgram,
  placeGemIx,
  postPositionIx,
  recruitIx,
  ringBellIx,
  strikeIx,
  takeGemIx,
} from "./program";
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
  node = 0,
): Promise<void> {
  const ix = await gatherIx(openProgram(rollup), signer.publicKey, owner, sessionToken, x, y, node);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "gather", "rollup", linkEndpoint);
}

/** Names the next wyrm using the Ember Egg. */
export async function nameNextWyrm(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  name: string,
): Promise<void> {
  const ix = await nameWyrmIx(openProgram(rollup), signer.publicKey, owner, sessionToken, name);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "name_wyrm", "rollup", linkEndpoint);
}

export async function crackShell(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  slot: number,
): Promise<void> {
  const crack = await crackIx(openProgram(rollup), signer.publicKey, owner, sessionToken, slot);
  await sendInstruction(rollup, keypairSigner(signer), [], crack, "crack", "rollup", linkEndpoint);
}

export async function revealShell(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  slot: number,
): Promise<string> {
  const reveal = await crackRevealIx(openProgram(rollup), signer.publicKey, owner, sessionToken, slot);
  return sendInstruction(rollup, keypairSigner(signer), [], reveal, "crack_reveal", "rollup", linkEndpoint);
}

export async function thawShell(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  slot: number,
): Promise<void> {
  await crackShell(rollup, signer, owner, sessionToken, linkEndpoint, slot);
  await laterSlot(rollup);
  await revealShell(rollup, signer, owner, sessionToken, linkEndpoint, slot);
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

/** One session-signed L1 action: craft, sell, buy, eat, equip. */
export async function playAction(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  kind: "craft" | "sell" | "buy" | "eat" | "equip",
  slot: number,
): Promise<void> {
  const program = openProgram(rollup);
  const payer = signer.publicKey;
  let ix: TransactionInstruction;
  let name = kind as string;
  switch (kind) {
    case "craft":
      ix = await craftIx(program, payer, owner, sessionToken, slot);
      break;
    case "sell":
      ix = await merchantSellIx(program, payer, owner, sessionToken, slot);
      name = "merchant_sell";
      break;
    case "buy":
      ix = await merchantBuyIx(program, payer, owner, sessionToken, slot);
      name = "merchant_buy";
      break;
    case "eat":
      ix = await eatIx(program, payer, owner, sessionToken, slot);
      break;
    default:
      ix = await equipIx(program, payer, owner, sessionToken, slot);
      break;
  }
  await sendInstruction(rollup, keypairSigner(signer), [], ix, name, "rollup", linkEndpoint);
}

/** Advances to the next room after a clear. */
export async function advanceRoom(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
): Promise<void> {
  const ix = await nextRoomIx(openProgram(rollup), signer.publicKey, owner, sessionToken);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "next_room", "rollup", linkEndpoint);
}

/** Lists one pack slot at a fixed price. */
export async function listItem(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  slot: number,
  price: string,
): Promise<void> {
  const ix = await listIx(openProgram(rollup), signer.publicKey, owner, sessionToken, slot, price);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "list", "rollup", linkEndpoint);
}

/** Takes an unsold listing back. */
export async function cancelListing(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  listing: number,
  revision: string,
): Promise<void> {
  const ix = await cancelIx(openProgram(rollup), signer.publicKey, owner, sessionToken, listing, revision);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "cancel", "rollup", linkEndpoint);
}

/** Buys a listing outright. */
export async function buyListing(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  listing: number,
  seller: PublicKey,
  revision: string,
  expectedPrice: string,
): Promise<void> {
  const ix = await buyIx(openProgram(rollup), signer.publicKey, owner, sessionToken, listing, seller, revision, expectedPrice);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "buy", "rollup", linkEndpoint);
}

/** Strikes the anvil with the item, its fodder and the Glints. */
export async function strikeAnvil(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  slot: number,
  fodder: number[],
  glints: string,
): Promise<void> {
  const ix = await strikeIx(openProgram(rollup), signer.publicKey, owner, sessionToken, slot, fodder, glints);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "strike", "rollup", linkEndpoint);
}

/** Steps into the Crater; the Glare runs inside. */
export async function enterCrater(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
): Promise<void> {
  const ix = await enterLairIx(openProgram(rollup), signer.publicKey, owner, sessionToken);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "enter_lair", "rollup", linkEndpoint);
}

/** Sends the move intent for the next lair tick. */
export async function aimLair(
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
  const ix = await lairInputIx(openProgram(rollup), signer.publicKey, owner, sessionToken, dx, dy, attack, dash);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "lair_input", "rollup", linkEndpoint);
}

/** Leaves the Crater early; the flushed damage still counts. */
export async function leaveCrater(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
): Promise<void> {
  const ix = await exitLairIx(openProgram(rollup), signer.publicKey, owner, sessionToken);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "exit_lair", "rollup", linkEndpoint);
}

/** Scoops a nearby spark into the purse. */
export async function scoopSpark(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
): Promise<void> {
  const ix = await catchSparkIx(openProgram(rollup), signer.publicKey, owner, sessionToken);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "catch_spark", "rollup", linkEndpoint);
}

/** Sets a block into a built lantern post. */
export async function setGem(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  slot: number,
): Promise<void> {
  const ix = await placeGemIx(openProgram(rollup), signer.publicKey, owner, sessionToken, slot);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "place_gem", "rollup", linkEndpoint);
}

/** Takes a placed block back. */
export async function unsetGem(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  post: number,
): Promise<void> {
  const ix = await takeGemIx(openProgram(rollup), signer.publicKey, owner, sessionToken, post);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "take_gem", "rollup", linkEndpoint);
}

/** Settles villager output into the pack. */
export async function collectGoods(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
): Promise<void> {
  const ix = await collectIx(openProgram(rollup), signer.publicKey, owner, sessionToken);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "collect", "rollup", linkEndpoint);
}

/** Feeds the village stockpile from one pack slot of food. */
export async function feedVillage(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  slot: number,
): Promise<void> {
  const ix = await feedIx(openProgram(rollup), signer.publicKey, owner, sessionToken, slot);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "feed", "rollup", linkEndpoint);
}

/** Rings the Hearth Bell. */
export async function ringHearthBell(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
): Promise<void> {
  const ix = await ringBellIx(openProgram(rollup), signer.publicKey, owner, sessionToken);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "ring_bell", "rollup", linkEndpoint);
}

/** Recruits the waiting wanderer for a 15-Glint gift. */
export async function hireWanderer(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  slot: number,
): Promise<void> {
  const ix = await recruitIx(openProgram(rollup), signer.publicKey, owner, sessionToken, slot);
  await sendInstruction(rollup, keypairSigner(signer), [], ix, "recruit", "rollup", linkEndpoint);
}

async function laterSlot(connection: Connection): Promise<void> {
  const start = await connection.getSlot("confirmed");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await connection.getSlot("confirmed")) > start) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(uiText("sealSlot"));
}

/** Waits for a later slot so `crack_reveal` sees a slot newer than the crack. */
export { laterSlot };
