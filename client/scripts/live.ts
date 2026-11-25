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
import { BASE_RPC, TEE_RPC } from "../src/chain/config";
import { rollupEndpoint } from "../src/chain/explorer";
import { enterMeadow } from "../src/chain/login";
import { ownedPda, sharedPda } from "../src/chain/pdas";
import {
  aimLair,
  aimRoom,
  chopTree,
  claimShare,
  enterCrater,
  enterRoom,
  keypairSigner,
  leaveCrater,
  leaveRoom,
  postMove,
  thawShell,
} from "../src/chain/play";
import { crackIx, openProgram } from "../src/chain/program";
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
  const linkToken = await authToken(session.signer.publicKey, signWithSecret(session.signer.secretKey));
  const rollup = new Connection(rollupEndpoint(TEE_RPC, walletToken), "confirmed");
  return { wallet, rollup, session, link: rollupEndpoint(TEE_RPC, linkToken) };
}

async function decoded(keeper: Keeper, name: string, at: PublicKey): Promise<Record<string, unknown> | null> {
  const info = await keeper.rollup.getAccountInfo(at);
  if (!info) return null;
  return openProgram(keeper.rollup).coder.accounts.decode(name, info.data) as Record<string, unknown>;
}

async function wood(keeper: Keeper): Promise<string> {
  const pack = await decoded(keeper, "inventory", ownedPda("inventory", keeper.wallet.publicKey));
  const slots = (pack?.slots ?? []) as Array<Record<string, unknown>>;
  return JSON.stringify(slots.slice(0, Number(pack?.count ?? 0)).map((slot) => [slot.kind, slot.count ?? slot.amount]));
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
    if ((Number(player?.gatherFlags) & 1) === 0) {
      say(`VRF callback landed after ~${tries * 500} ms; pack: ${await wood(keeper)}`);
      return;
    }
    await pause(500);
  }
  say("FAIL: the gather callback did not arrive in 10 s");
}

async function stranger(): Promise<void> {
  const nobody = Keypair.generate();
  const token = await authToken(nobody.publicKey, signWithSecret(nobody.secretKey));
  const rollup = new Connection(rollupEndpoint(TEE_RPC, token), "confirmed");
  for (const name of ["world", "season"] as const) {
    const info = await rollup.getAccountInfo(sharedPda(name)).catch((err: unknown) => String(err));
    const seen = info === null ? "hidden (null)" : typeof info === "string" ? `refused (${info.slice(0, 60)})` : `READABLE, ${info.data.length} bytes`;
    say(`a stranger reads ${name}: ${seen}`);
  }
}

async function thaw(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet, link } = keeper;
  const pack = await decoded(keeper, "inventory", ownedPda("inventory", wallet.publicKey));
  const slots = (pack?.slots ?? []) as Array<Record<string, unknown>>;
  say(`slots: ${JSON.stringify(slots.slice(0, Number(pack?.count ?? 0)))}`.slice(0, 900));
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

async function crater(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet, link } = keeper;
  await enterCrater(rollup, session.signer, wallet.publicKey, session.token, link);
  const seconds = Number(process.env.LIVE_SECONDS ?? "8");
  for (let beat = 0; beat < seconds * 2; beat += 1) {
    if (beat % 2 === 0) await aimLair(rollup, session.signer, wallet.publicKey, session.token, link, 0, -1, 1, 0);
    const season = await decoded(keeper, "season", sharedPda("season"));
    say(`${beat * 500} ms: ${await arenaLine(keeper)} · total damage ${String(season?.totalDamage)}`);
    await pause(500);
  }
  await leaveCrater(rollup, session.signer, wallet.publicKey, session.token, link);
  say(`left: ${await arenaLine(keeper)}`);
}

async function claim(keeper: Keeper): Promise<void> {
  const base = new Connection(BASE_RPC, "confirmed");
  const before = await base.getBalance(keeper.wallet.publicKey);
  await claimShare(base, keypairSigner(keeper.wallet));
  say(`claimed ${((await base.getBalance(keeper.wallet.publicKey)) - before) / LAMPORTS_PER_SOL} SOL`);
}

/** Sends one instruction with preflight on and prints the rollup's own refusal. A debugging aid. */
async function raw(keeper: Keeper): Promise<void> {
  const { rollup, session, wallet } = keeper;
  const slot = Number(process.env.LIVE_SLOT ?? "0");
  const ix = await crackIx(openProgram(rollup), session.signer.publicKey, wallet.publicKey, session.token, slot);
  const { blockhash } = await rollup.getLatestBlockhash();
  const tx = new Transaction({ feePayer: session.signer.publicKey, recentBlockhash: blockhash }).add(ix);
  tx.sign(session.signer);
  const sim = await rollup.simulateTransaction(tx).catch((err: unknown) => String(err));
  say(typeof sim === "string" ? sim.slice(0, 600) : JSON.stringify(sim.value).slice(0, 1500));
}

const STEPS: Record<string, (keeper: Keeper) => Promise<void>> = { enter, gather, thaw, cellar, crater, claim, raw };

async function main(): Promise<void> {
  const step = process.argv[2] ?? "enter";
  if (step === "private") return stranger();
  const todo = STEPS[step];
  if (!todo) throw new Error(`unknown step ${step}`);
  const keeper = await open();
  try {
    await todo(keeper);
  } finally {
    for (const row of useTxLog.getState().rows ?? []) {
      say(`  ${row.ok ? "ok  " : "FAIL"} ${row.instruction} ${row.latencyMs} ms ${row.signature.slice(0, 16)}`);
    }
  }
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);
