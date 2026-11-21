import { sha256 } from "./sha";

export function sealMatches(key: Uint8Array, commitment: Uint8Array): boolean {
  if (key.length !== 32 || commitment.length !== 32) return false;
  if (key.every((byte) => byte === 0)) return false;
  const hash = sha256(key);
  return hash.every((byte, index) => byte === commitment[index]);
}
