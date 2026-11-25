/**
 * Shared pieces of the devnet admin scripts: addresses, PDAs, the admin wallet
 * and the two providers. Devnet only. Nothing here prints a key or a token.
 */
import anchor from "@coral-xyz/anchor";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import nacl from "tweetnacl";

const { AnchorProvider, BN, Program, Wallet } = anchor;

export { BN };
export type Game = InstanceType<typeof Program>;

export const PROGRAM_ID = new PublicKey("FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS");
export const DELEGATION = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
export const VALIDATOR = new PublicKey("MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo");
export const MAGIC = new PublicKey("Magic11111111111111111111111111111111111111");
export const MAGIC_CONTEXT = new PublicKey("MagicContext1111111111111111111111111111111");
export const PERMISSION = new PublicKey("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");
export const EPHEMERAL_VAULT = new PublicKey("MagicVau1t999999999999999999999999999999999");
export const VRF = new PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");
export const QUEUE = new PublicKey("5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc");
export const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");

const DEVNET_BASE = "https://api.devnet.solana.com";
const DEVNET_TEE = "https://devnet-tee.magicblock.app";

/**
 * Reads `scripts/.env` before any other code asks for a variable, because the
 * shell does not load it for `node scripts/*.ts`. Values already in the
 * environment win, so an explicit export is never overridden. The file is
 * gitignored; nothing here prints a value.
 */
function loadEnv(): void {
  let text = "";
  try {
    text = readFileSync(new URL("./.env", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const idl = JSON.parse(readFileSync(new URL("../client/src/gen/idl/sunhoard.json", import.meta.url), "utf8"));

export function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

export function pda(seeds: Uint8Array[], program = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync(seeds.map((seed) => Buffer.from(seed)), program)[0];
}

export function text(value: string): Uint8Array {
  return Buffer.from(value);
}

/** The shared accounts every admin call names. */
export function shared() {
  return {
    season: pda([text("season")]),
    world: pda([text("world")]),
    market: pda([text("market")]),
    prices: pda([text("prices")]),
    presence: pda([text("presence")]),
    vault: pda([text("vault")]),
    identity: pda([text("identity")]),
  };
}

export function payoutPda(seasonNumber: number): PublicKey {
  return pda([text("payout"), Buffer.from(new BN(seasonNumber).toArray("le", 8))]);
}

export function owned(seed: string, owner: PublicKey): PublicKey {
  return pda([text(seed), owner.toBytes()]);
}

export function permissionPda(account: PublicKey): PublicKey {
  return pda([text("permission:"), account.toBytes()], PERMISSION);
}

/** The delegation program's three accounts for one delegated account. */
export function trio(account: PublicKey) {
  return {
    buffer: pda([text("buffer"), account.toBytes()]),
    record: pda([text("delegation"), account.toBytes()], DELEGATION),
    metadata: pda([text("delegation-metadata"), account.toBytes()], DELEGATION),
  };
}

export function budget(): TransactionInstruction {
  return ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
}

/** Refuses anything that is not devnet: these scripts never touch mainnet. */
function devnetOnly(url: string): string {
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  if (!local && !host.includes("devnet")) {
    throw new Error(`refusing ${host}: these scripts are devnet only`);
  }
  return url;
}

/** The admin keypair, read from its path outside the repo. It is never printed. */
export function adminKeypair(): Keypair {
  const fallback = `${homedir()}/.config/solana/sunhoard-admin.json`;
  const path = (process.env.ANCHOR_WALLET ?? fallback).replace("$HOME", homedir());
  const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function baseGame(admin: Keypair): Game {
  const url = devnetOnly(process.env.ANCHOR_PROVIDER_URL ?? DEVNET_BASE);
  return gameAt(new Connection(url, "confirmed"), admin);
}

/**
 * The rollup program handle. The private rollup wants a token signed by the
 * caller; it rides in the URL and is never logged.
 */
export async function rollupGame(admin: Keypair): Promise<Game> {
  const url = devnetOnly(process.env.ER_URL ?? DEVNET_TEE).replace(/\/$/, "");
  const sign = (message: Uint8Array) => Promise.resolve(nacl.sign.detached(message, admin.secretKey));
  const { token } = await getAuthToken(url, admin.publicKey, sign);
  return gameAt(new Connection(`${url}?token=${token}`, "confirmed"), admin);
}

/** A program handle that only builds instructions. It never opens a socket. */
export function offlineGame(wallet: Keypair): Game {
  return gameAt(new Connection("http://127.0.0.1:1", "confirmed"), wallet);
}

function gameAt(connection: Connection, wallet: Keypair): Game {
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: "confirmed" });
  return new Program(idl, provider);
}

/** Runs a script's main and turns a failure into one plain line. */
export function run(main: () => Promise<void>): void {
  main().catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
