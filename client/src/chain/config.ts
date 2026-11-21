import { PublicKey } from "@solana/web3.js";

function required(name: keyof ImportMetaEnv, fallback: string): string {
  const value = import.meta.env[name];
  return value && value.length > 0 ? value : fallback;
}

export const BASE_RPC = required("VITE_BASE_RPC", "https://api.devnet.solana.com");
export const TEE_RPC = required("VITE_TEE_RPC", "https://devnet-tee.magicblock.app").replace(/\/$/, "");
export const PROGRAM_ID = new PublicKey(
  required("VITE_PROGRAM_ID", "FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS"),
);
export const VALIDATOR = new PublicKey(
  required("VITE_VALIDATOR", "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo"),
);
export const ORACLE_QUEUE = new PublicKey(
  required("VITE_ORACLE_QUEUE", "5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc"),
);

export const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
export const PERMISSION_PROGRAM_ID = new PublicKey("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");
export const EPHEMERAL_VAULT = new PublicKey("MagicVau1t999999999999999999999999999999999");
export const MAGIC_PROGRAM_ID = new PublicKey("Magic11111111111111111111111111111111111111");
export const VRF_PROGRAM_ID = new PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");
export const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");

export const MEADOW_ZONE = 0;
export const BIRCH_NODE = 0;
export const SESSION_SECONDS = 12 * 60 * 60;
export const SESSION_TOP_UP = 2_000_000;
export const COMPUTE_UNITS = 1_400_000;
