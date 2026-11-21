import { PublicKey } from "@solana/web3.js";
import { DELEGATION_PROGRAM_ID, PERMISSION_PROGRAM_ID, PROGRAM_ID } from "./config";

function pda(seeds: Uint8Array[], program = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync(seeds.map((seed) => Buffer.from(seed)), program)[0];
}

function text(value: string): Uint8Array {
  return Buffer.from(value);
}

export function sharedPda(name: "season" | "world" | "market" | "prices" | "presence" | "vault"): PublicKey {
  return pda([text(name)]);
}

export function ownedPda(
  name: "player" | "purse" | "inventory" | "village" | "arena" | "view",
  owner: PublicKey,
): PublicKey {
  return pda([text(name), owner.toBytes()]);
}

export function payoutPda(): PublicKey {
  const season = new Uint8Array(8);
  season[0] = 1;
  return pda([text("payout"), season]);
}

export function identityPda(): PublicKey {
  return pda([text("identity")]);
}

export function permissionPda(account: PublicKey): PublicKey {
  return pda([text("permission:"), account.toBytes()], PERMISSION_PROGRAM_ID);
}

export interface DelegationTrio {
  buffer: PublicKey;
  record: PublicKey;
  metadata: PublicKey;
}

export function delegationTrio(account: PublicKey): DelegationTrio {
  return {
    buffer: pda([text("buffer"), account.toBytes()]),
    record: pda([text("delegation"), account.toBytes()], DELEGATION_PROGRAM_ID),
    metadata: pda([text("delegation-metadata"), account.toBytes()], DELEGATION_PROGRAM_ID),
  };
}

export function sessionTokenPda(
  sessionProgram: PublicKey,
  signer: PublicKey,
  authority: PublicKey,
): PublicKey {
  return pda(
    [text("session_token_v2"), PROGRAM_ID.toBytes(), signer.toBytes(), authority.toBytes()],
    sessionProgram,
  );
}
