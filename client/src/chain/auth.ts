import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { TEE_RPC } from "./config";

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
  if (hit && hit.expiresAt > Date.now() + 30_000) return hit.token;
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = getAuthToken(TEE_RPC, authority, sign).then(result => {
    const expiresAt = result.expiresAt < 1e12 ? result.expiresAt * 1000 : result.expiresAt;
    if (inflight.get(key) === request) cache.set(key, { pubkey: key, token: result.token, expiresAt });
    return result.token;
  }).finally(() => { if (inflight.get(key) === request) inflight.delete(key); });
  inflight.set(key, request);
  return request;
}

export function authExpiry(key: string): number {
  return cache.get(key)?.expiresAt ?? 0;
}

export function forgetAuth(key: string): void {
  cache.delete(key);
  inflight.delete(key);
}

export function signWithSecret(secret: Uint8Array): Signer {
  return (message) => Promise.resolve(nacl.sign.detached(message, secret));
}
