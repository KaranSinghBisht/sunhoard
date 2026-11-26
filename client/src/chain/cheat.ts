import { Connection, Keypair, type PublicKey } from "@solana/web3.js";
import { authToken, forgetAuth, signWithSecret } from "./auth";
import { TEE_RPC } from "./config";
import { rollupEndpoint } from "./explorer";
import { ownedPda, sharedPda } from "./pdas";

/** What one reader got back for each account: its size in bytes, or null when the rollup gave nothing. */
export interface Peek {
  season: number | null;
  world: number | null;
  purse: number | null;
}

async function peek(rollup: Connection, victim: PublicKey): Promise<Peek> {
  const [season, world, purse] = await rollup.getMultipleAccountsInfo(
    [sharedPda("season"), sharedPda("world"), ownedPda("purse", victim)],
    "confirmed",
  );
  return { season: season?.data.length ?? null, world: world?.data.length ?? null, purse: purse?.data.length ?? null };
}

/**
 * The cheat a public chain allows: ask the RPC for someone else's accounts.
 * A fresh key with no rights signs in to the private rollup and asks for the
 * public Season, the sealed World (Old Gloam's HP and the loot salts) and the
 * victim's purse. The key is thrown away afterwards.
 */
export async function peekAsStranger(victim: PublicKey): Promise<Peek> {
  const stranger = Keypair.generate();
  const key = stranger.publicKey.toBase58();
  try {
    const token = await authToken(stranger.publicKey, signWithSecret(stranger.secretKey));
    return await peek(new Connection(rollupEndpoint(TEE_RPC, token), "confirmed"), victim);
  } finally {
    forgetAuth(key);
  }
}

/** The same three reads with the player's own connection, for comparison. */
export function peekAsOwner(rollup: Connection, owner: PublicKey): Promise<Peek> {
  return peek(rollup, owner);
}
