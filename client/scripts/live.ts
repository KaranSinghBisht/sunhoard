/**
 * A live run against devnet that drives the page's own chain code with a
 * throwaway keeper, so every step the browser takes is proven without a wallet
 * popup. Devnet only. It prints no key and no token.
 *
 *   cd game/client
 *   corepack yarn live enter      # sign up, delegate, join, session
 *   corepack yarn live gather     # chop, then wait for the VRF bonus
 *   corepack yarn live private    # a stranger must not read World
 *   corepack yarn live thaw       # crack and reveal the first sealed shell
 *   corepack yarn live cellar     # one room on the 100 ms crank
 *   corepack yarn live crater     # hit Old Gloam for a few seconds
 *   corepack yarn live claim      # claim the keeper's share on Solana
 *   LIVE_ACT=sell LIVE_SLOT=3 corepack yarn live act   # one pack action
 *
 * `LIVE_KEEPER=2` picks a second keeper. Keys live in `game/.secrets/` (gitignored)
 * and are funded with devnet SOL from the admin key.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { authToken, signWithSecret } from "../src/chain/auth";
import { checkAccountPrivacy, checkCallbackPrivacy } from "./privacy";
import { BASE_RPC, PROGRAM_ID, TEE_RPC } from "../src/chain/config";
import { rollupEndpoint } from "../src/chain/explorer";
import { enterMeadow } from "../src/chain/login";
import { ownedPda, sharedPda } from "../src/chain/pdas";
import {
  aimLair,
  aimRoom,
  buyListing,
  chopTree,
  claimShare,
  enterCrater,
  enterRoom,
  keypairSigner,
  leaveCrater,
  leaveRoom,
  listItem,
  playAction,
  strikeAnvil,
  postMove,
  thawShell,
} from "../src/chain/play";
import { crackIx, claimGlintsIx, openProgram } from "../src/chain/program";
import { sendInstruction } from "../src/chain/send";
import { createSession, type LiveSession } from "../src/chain/session";
import { useTxLog } from "../src/chain/txlog";

/** Run from `game/client`; the keys sit beside the repo's other gitignored secrets. */
const SECRETS = pathToFileURL(`${resolve(process.cwd(), "../.secrets")}/`);
const FUND_LAMPORTS = 0.6 * LAMPORTS_PER_SOL;
const BIRCH = { x: 376, y: 240 };

interface Keeper {
  wallet: Keypair;
  rollup: Connection;
  session: LiveSession;
  link: string;
}

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The page keeps its session key in sessionStorage; a script has none. */
function shimStorage(file: URL): void {
  const held = new Map<string, string>(existsSync(file) ? Object.entries(JSON.parse(readFileSync(file, "utf8"))) : []);
  const save = () => writeFileSync(file, JSON.stringify(Object.fromEntries(held)), { mode: 0o600 });
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => void (held.set(key, value), save()),
    removeItem: (key: string) => void (held.delete(key), save()),
  };
}

function loadKey(file: URL): Keypair {
  if (existsSync(file)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, "utf8"))));
  const made = Keypair.generate();
  writeFileSync(file, JSON.stringify(Array.from(made.secretKey)), { mode: 0o600 });
  return made;
}

async function fund(base: Connection, to: PublicKey): Promise<void> {
  if ((await base.getBalance(to)) >= FUND_LAMPORTS / 2) return;
  const path = `${homedir()}/.config/solana/sunhoard-admin.json`;
  const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: to, lamports: FUND_LAMPORTS }),
  );
  const signature = await base.sendTransaction(tx, [admin]);
  await base.confirmTransaction(signature, "confirmed");
  say(`funded the keeper with ${FUND_LAMPORTS / LAMPORTS_PER_SOL} devnet SOL`);
}

/** The same order as the page's "Enter the meadow" button. */
async function open(): Promise<Keeper> {
  const number = process.env.LIVE_KEEPER ?? "1";
  mkdirSync(SECRETS, { recursive: true });
  shimStorage(new URL(`live-session-${number}.json`, SECRETS));
  const wallet = loadKey(new URL(`live-keeper-${number}.json`, SECRETS));
  const base = new Connection(BASE_RPC, "confirmed");
  await fund(base, wallet.publicKey);
  say(`keeper ${number}: ${wallet.publicKey.toBase58()}`);
  const signer = keypairSigner(wallet);
  const walletToken = await enterMeadow(base, wallet.publicKey, signer, signWithSecret(wallet.secretKey), "");
  const session = await createSession(base, signer, wallet.publicKey);
  const rollup = new Connection(rollupEndpoint(TEE_RPC, walletToken), "confirmed");
  return { wallet, rollup, session, link: "" };
}

async function decoded(keeper: Keeper, name: string, at: PublicKey): Promise<Record<string, unknown> | null> {
  const info = await keeper.rollup.getAccountInfo(at);
  if (!info) return null;
  return openProgram(keeper.rollup).coder.accounts.decode(name, info.data) as Record<string, unknown>;
}

async function wood(keeper: Keeper): Promise<string> {
  const pack = await decoded(keeper, "inventory", ownedPda("inventory", keeper.wallet.publicKey));
  const slots = (pack?.slots ?? []) as Array<Record<string, unknown>>;
  return JSON.stringify(slots.filter(slot => Number(slot.quantity) > 0).map(slot => [slot.kind, slot.quantity]));
}

async function enter(keeper: Keeper): Promise<void> {
  const player = await decoded(keeper, "player", ownedPda("player", keeper.wallet.publicKey));
  say(`joined as player ${String(player?.playerNumber)} at (${String(player?.x)}, ${String(player?.y)})`);
  const season = await decoded(keeper, "season", sharedPda("season"));
  say(`season ${String(season?.seasonNumber)} · phase ${String(season?.phase)} · pot ${String(season?.pot)}`);
}

async function gather(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet, link } = keeper;
  const owner = wallet.publicKey;
  await postMove(rollup, session.signer, owner, session.token, link, BIRCH.x - 16, BIRCH.y, 0);
  say(`pack before: ${await wood(keeper)}`);
  await chopTree(rollup, session.signer, owner, session.token, link, BIRCH.x, BIRCH.y, 0);
  say(`pack after the chop: ${await wood(keeper)}`);
  for (let tries = 0; tries < 20; tries += 1) {
    const player = await decoded(keeper, "player", ownedPda("player", owner));
    if (player && (Number(player.gatherFlags) & 1) === 0) {
      say(`VRF callback landed after ~${tries * 500} ms; pack: ${await wood(keeper)}`);
      return;
    }
    await pause(500);
  }
  throw new CheckFailure("The gather callback did not arrive in 10 s.");
}

class CheckFailure extends Error {}

async function stranger(callback: boolean): Promise<void> {
  const nobody = Keypair.generate();
  const token = await authToken(nobody.publicKey, signWithSecret(nobody.secretKey));
  const rollup = new Connection(rollupEndpoint(TEE_RPC, token), "confirmed");
  try {
    await checkAccountPrivacy(async () => {
      const info = await rollup.getAccountInfo(sharedPda("season"));
      if (!info?.owner.equals(PROGRAM_ID)) return false;
      const data = openProgram(rollup).coder.accounts.decode("season", info.data);
      return Number(data.seasonNumber) > 0;
    }, async () => (await rollup.getAccountInfo(sharedPda("world"))) !== null);
    say("Stranger read the public Season and received null for World.");
    if (!callback) return;
    const signature = process.env.LIVE_SALT_CALLBACK;
    if (!signature) throw new CheckFailure("Set LIVE_SALT_CALLBACK to the operator-verified salt callback signature.");
    await checkCallbackPrivacy(async () => {
      const result = await rollup.getSignatureStatuses([signature], { searchTransactionHistory: true });
      const status = result.value[0];
      return !!status && !status.err && ["confirmed", "finalized"].includes(status.confirmationStatus ?? "");
    }, async () => (await rollup.getTransaction(signature, {
      commitment: "confirmed", maxSupportedTransactionVersion: 0,
    })) !== null);
    say("Supplied callback has a successful status and its transaction body is hidden from this stranger.");
  } catch (err) {
    // Only known local diagnostics are printable. Transport errors can contain the authenticated URL.
    if (err instanceof CheckFailure) throw err;
    const safe = ["Public Season control unavailable.", "Private World was visible.",
      "Callback inclusion could not be confirmed.", "Private callback transaction was visible."];
    if (err instanceof Error && safe.includes(err.message)) throw new CheckFailure(err.message);
    throw new CheckFailure("Privacy result inconclusive. The control, decoder or RPC request failed.");
  }
}

async function thaw(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet, link } = keeper;
  const pack = await decoded(keeper, "inventory", ownedPda("inventory", wallet.publicKey));
  const slots = (pack?.slots ?? []) as Array<Record<string, unknown>>;
  // Slots are sparse, so each used one is named by its own number.
  slots.forEach((item, index) => {
    if (Number(item.quantity) > 0) say(`slot ${index}: kind ${String(item.kind)} ×${String(item.quantity)} flags ${String(item.flags)}`);
  });
  const slot = Number(process.env.LIVE_SLOT ?? "-1");
  if (slot < 0) return say("set LIVE_SLOT to the sealed shell's slot to thaw it");
  await thawShell(rollup, session.signer, wallet.publicKey, session.token, link, slot);
  const after = await decoded(keeper, "inventory", ownedPda("inventory", wallet.publicKey));
  say(`thawed: ${JSON.stringify((after?.slots as unknown[])[slot])}`.slice(0, 600));
}

async function arenaLine(keeper: Keeper): Promise<string> {
  const arena = await decoded(keeper, "arena", ownedPda("arena", keeper.wallet.publicKey));
  return `mode ${String(arena?.mode)} step ${String(arena?.stepIndex)} hp ${String(arena?.playerHp)} foes ${String(arena?.monsterCount)} cleared ${String(arena?.cleared)} at (${String(arena?.playerX)}, ${String(arena?.playerY)})`;
}

async function cellar(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet, link } = keeper;
  await enterRoom(rollup, session.signer, wallet.publicKey, session.token, link);
  for (let beat = 0; beat < 16; beat += 1) {
    if (beat % 4 === 1) await aimRoom(rollup, session.signer, wallet.publicKey, session.token, link, 1, 0, 1, 0);
    say(`${beat * 500} ms: ${await arenaLine(keeper)}`);
    await pause(500);
  }
  await leaveRoom(rollup, session.signer, wallet.publicKey, session.token, link);
  say(`left: ${await arenaLine(keeper)}`);
}

/** Walks at Old Gloam and swings, visit after visit, until `LIVE_SECONDS` run out or the wyrm falls. */
async function crater(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet, link } = keeper;
  const owner = wallet.publicKey;
  const until = Date.now() + Number(process.env.LIVE_SECONDS ?? "8") * 1000;
  while (Date.now() < until) {
    // A visit left open by an earlier run is closed first.
    await enterCrater(rollup, session.signer, owner, session.token, link).catch(async () => {
      await leaveCrater(rollup, session.signer, owner, session.token, link);
      await enterCrater(rollup, session.signer, owner, session.token, link);
    });
    for (let beat = 0; Date.now() < until; beat += 1) {
      const arena = await decoded(keeper, "arena", ownedPda("arena", owner));
      if (Number(arena?.mode) !== 3) break;
      const gloam = (arena?.monsters as Array<{ body: { x: number; y: number } }>)[0].body;
      const gapX = gloam.x - Number(arena?.playerX);
      const gapY = gloam.y - Number(arena?.playerY);
      // Stand still only when the wyrm is in reach and in front; otherwise step at it along the longer axis, which also turns the keeper.
      const facing = Number((arena?.player as { facing: number }).facing);
      const dot = gapX * (facing === 0 ? 1 : facing === 2 ? -1 : 0) + gapY * (facing === 1 ? 1 : facing === 3 ? -1 : 0);
      const reach = gapX * gapX + gapY * gapY;
      const aimed = reach <= 18 * 18 && dot > 0 && dot * dot * 2 >= reach;
      const wide = Math.abs(gapX) > Math.abs(gapY);
      const dx = aimed || !wide ? 0 : Math.sign(gapX);
      const dy = aimed || wide ? 0 : Math.sign(gapY);
      // A swing is spent once it lands, so the intent goes out again on every beat.
      const sent = await aimLair(rollup, session.signer, owner, session.token, link, dx, dy, 1, 0).then(
        () => true,
        () => false,
      );
      if (!sent) break;
      if (beat % 16 === 0) say(`${await arenaLine(keeper)} · hits ${String(arena?.lairHits)}`);
      await pause(40);
    }
    const season = await decoded(keeper, "season", sharedPda("season"));
    say(`visit over · total damage ${String(season?.totalDamage)} · phase ${String(season?.phase)} · flags ${String(season?.flags)}`);
    const arena = await decoded(keeper, "arena", ownedPda("arena", owner));
    if (Number(arena?.mode) === 3) await leaveCrater(rollup, session.signer, owner, session.token, link);
    if ((Number(season?.flags) & 2) !== 0) return say("Old Gloam has fallen");
  }
}

async function claim(keeper: Keeper): Promise<void> {
  const base = new Connection(BASE_RPC, "confirmed");
  const before = await base.getBalance(keeper.wallet.publicKey);
  await claimShare(base, keypairSigner(keeper.wallet));
  say(`claimed ${((await base.getBalance(keeper.wallet.publicKey)) - before) / LAMPORTS_PER_SOL} SOL`);
}

/** One pack action: `LIVE_ACT=sell|buy|craft|eat|equip LIVE_SLOT=<slot, good or recipe>`. */
async function act(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet, link } = keeper;
  const kind = (process.env.LIVE_ACT ?? "sell") as "craft" | "sell" | "buy" | "eat" | "equip";
  await playAction(rollup, session.signer, wallet.publicKey, session.token, link, kind, Number(process.env.LIVE_SLOT ?? "0"));
  const purse = await decoded(keeper, "purse", ownedPda("purse", wallet.publicKey));
  say(`purse: ${String(purse?.glints)} Glint hundredths · pack: ${await wood(keeper)}`);
}

/** The Coldfair: `LIVE_FAIR=list LIVE_SLOT=3 LIVE_PRICE=1000`, or `LIVE_FAIR=buy LIVE_LISTING=0 LIVE_SELLER=<wallet>`. */
async function fair(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet, link } = keeper;
  if (process.env.LIVE_FAIR === "buy") {
    const seller = new PublicKey(process.env.LIVE_SELLER ?? "");
    const index = Number(process.env.LIVE_LISTING ?? "0");
    // The buyer names the revision and price it saw; the program refuses anything else.
    const seen = (await listings(keeper))[index];
    await buyListing(rollup, session.signer, wallet.publicKey, session.token, link, index, seller, String(seen.revision), String(seen.price));
  } else {
    const slot = Number(process.env.LIVE_SLOT ?? "0");
    await listItem(rollup, session.signer, wallet.publicKey, session.token, link, slot, process.env.LIVE_PRICE ?? "1000");
    const mine = (await listings(keeper)).findIndex((entry) => String(entry.seller) === wallet.publicKey.toBase58());
    say(`listed as listing ${mine}`);
  }
  const purse = await decoded(keeper, "purse", ownedPda("purse", wallet.publicKey));
  const season = await decoded(keeper, "season", sharedPda("season"));
  say(`purse ${String(purse?.glints)} · pot ${String(season?.pot)} · burned ${String(season?.burned)} · pack ${await wood(keeper)}`);
}

async function listings(keeper: Keeper): Promise<Array<Record<string, unknown>>> {
  const market = await decoded(keeper, "market", sharedPda("market"));
  return (market?.listings ?? []) as Array<Record<string, unknown>>;
}

/** The anvil: `LIVE_SLOT=5 LIVE_FODDER=6,7 LIVE_GLINTS=1000 corepack yarn live strike`. */
async function strike(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet, link } = keeper;
  const slot = Number(process.env.LIVE_SLOT ?? "0");
  const fodder = (process.env.LIVE_FODDER ?? "").split(",").filter(Boolean).map(Number);
  const before = await decoded(keeper, "inventory", ownedPda("inventory", wallet.publicKey));
  say(`before: rarity ${String((before?.slots as Array<Record<string, unknown>>)[slot].rarity)}`);
  await strikeAnvil(rollup, session.signer, wallet.publicKey, session.token, link, slot, fodder, process.env.LIVE_GLINTS ?? "0");
  await pause(3000);
  const after = await decoded(keeper, "inventory", ownedPda("inventory", wallet.publicKey));
  const item = (after?.slots as Array<Record<string, unknown>>)[slot];
  const player = await decoded(keeper, "player", ownedPda("player", wallet.publicKey));
  say(`after: kind ${String(item.kind)} rarity ${String(item.rarity)} flags ${String(item.flags)} · heat ${JSON.stringify(player?.heat)}`);
}

/** Collects the keeper's share of the Glint hoard after a settled kill. */
async function glints(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet, link } = keeper;
  const season = await decoded(keeper, "season", sharedPda("season"));
  const before = await decoded(keeper, "purse", ownedPda("purse", wallet.publicKey));
  const ix = await claimGlintsIx(openProgram(rollup), session.signer.publicKey, wallet.publicKey, session.token, Number(season?.seasonNumber));
  await sendInstruction(rollup, keypairSigner(session.signer), [], ix, "claim_glints", "rollup", link);
  const after = await decoded(keeper, "purse", ownedPda("purse", wallet.publicKey));
  const left = await decoded(keeper, "season", sharedPda("season"));
  say(`purse ${String(before?.glints)} → ${String(after?.glints)} · hoard left ${String(left?.pot)}`);
}

/** Sends one instruction with preflight on and prints the rollup's own refusal. A debugging aid. */
async function raw(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet } = keeper;
  const slot = Number(process.env.LIVE_SLOT ?? "0");
  const ix = await crackIx(openProgram(rollup), session.signer.publicKey, wallet.publicKey, session.token, slot);
  const { blockhash } = await rollup.getLatestBlockhash();
  const tx = new Transaction({ feePayer: session.signer.publicKey, recentBlockhash: blockhash }).add(ix);
  tx.sign(session.signer);
  const sim = await rollup.simulateTransaction(tx);
  if (sim.value.err) throw new CheckFailure("The rollup declined the simulated thaw.");
  say("The rollup accepted the simulated thaw.");
}

const STEPS: Record<string, (keeper: Keeper) => Promise<void>> = { enter, gather, thaw, cellar, crater, claim, glints, act, fair, strike, raw };

async function main(): Promise<void> {
  const step = process.argv[2] ?? "enter";
  if (step === "private" || step === "private-callback") return stranger(step === "private-callback");
  const todo = STEPS[step];
  if (!todo) throw new Error(`unknown step ${step}`);
  const keeper = await open();
  try {
    await todo(keeper);
  } finally {
    for (const row of useTxLog.getState().rows) {
      say(`  ${row.status} ${row.instruction} ${row.latencyMs} ms ${row.signature.slice(0, 16)}`);
    }
  }
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    process.stderr.write(`${err instanceof CheckFailure ? err.message : "Live check failed. Check the network, keeper state and command arguments."}\n`);
    process.exit(1);
  },
);
