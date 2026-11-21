import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { TEE_RPC } from "./config";
import { log } from "./log";

type Signer = (message: Uint8Array) => Promise<Uint8Array>;

interface Cached {
  pubkey: string;
  token: string;
  expiresAt: number;
}

const cache = new Map<string, Cached>();
const inflight = new Map<string, Promise<string>>();

export async function authToken(authority: PublicKey, sign: Signer): Promise<string> {
  const key = authority.toBase58();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now() / 1000 + 30) return hit.token;
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = requestToken(authority, sign).finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

async function requestToken(authority: PublicKey, sign: Signer): Promise<string> {
  log("requesting a rollup token");
  const result = await getAuthToken(TEE_RPC, authority, sign);
  cache.set(authority.toBase58(), {
    pubkey: authority.toBase58(),
    token: result.token,
    expiresAt: result.expiresAt,
  });
  return result.token;
}

export function signWithSecret(secret: Uint8Array): Signer {
  return (message) => Promise.resolve(nacl.sign.detached(message, secret));
}
