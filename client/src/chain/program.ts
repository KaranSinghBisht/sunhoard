import { type Idl, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";
import idl from "../gen/idl/sunhoard.json";
import {
  BIRCH_NODE,
  DELEGATION_PROGRAM_ID,
  EPHEMERAL_VAULT,
  MAGIC_PROGRAM_ID,
  MEADOW_ZONE,
  ORACLE_QUEUE,
  PERMISSION_PROGRAM_ID,
  PROGRAM_ID,
  SLOT_HASHES,
  VALIDATOR,
  VRF_PROGRAM_ID,
} from "./config";
import { delegationTrio, identityPda, ownedPda, payoutPda, permissionPda, sharedPda } from "./pdas";

const programIdl = idl as Idl;

export function openProgram(connection: Connection): Program {
  return new Program(programIdl, { connection });
}

function systemProgram(): PublicKey {
  return SystemProgram.programId;
}

export async function signUpIx(program: Program, owner: PublicKey): Promise<TransactionInstruction> {
  return program.methods
    .signUp()
    .accountsPartial({
      owner,
      player: ownedPda("player", owner),
      purse: ownedPda("purse", owner),
      inventory: ownedPda("inventory", owner),
      village: ownedPda("village", owner),
      arena: ownedPda("arena", owner),
      view: ownedPda("view", owner),
      systemProgram: systemProgram(),
    })
    .instruction();
}

function delegateAccounts(owner: PublicKey, names: Array<"player" | "purse" | "inventory" | "village" | "arena" | "view">) {
  const accounts: Record<string, PublicKey> = {
    owner,
    validator: VALIDATOR,
    ownerProgram: PROGRAM_ID,
    delegationProgram: DELEGATION_PROGRAM_ID,
    systemProgram: systemProgram(),
  };
  for (const name of names) {
    const account = ownedPda(name, owner);
    const trio = delegationTrio(account);
    const label = name[0].toUpperCase() + name.slice(1);
    accounts[`buffer${label}`] = trio.buffer;
    accounts[`delegationRecord${label}`] = trio.record;
    accounts[`delegationMetadata${label}`] = trio.metadata;
    accounts[name] = account;
  }
  return accounts;
}

export async function delegatePlayerIx(program: Program, owner: PublicKey): Promise<TransactionInstruction> {
  return program.methods.delegatePlayer().accountsPartial(delegateAccounts(owner, ["player", "purse", "inventory"])).instruction();
}

export async function delegateHomeIx(program: Program, owner: PublicKey): Promise<TransactionInstruction> {
  return program.methods.delegateHome().accountsPartial(delegateAccounts(owner, ["village", "arena", "view"])).instruction();
}

export async function joinIx(program: Program, owner: PublicKey): Promise<TransactionInstruction> {
  const purse = ownedPda("purse", owner);
  const view = ownedPda("view", owner);
  return program.methods
    .join()
    .accountsPartial({
      owner,
      season: sharedPda("season"),
      player: ownedPda("player", owner),
      purse,
      pursePermission: permissionPda(purse),
      view,
      viewPermission: permissionPda(view),
      inventory: ownedPda("inventory", owner),
      village: ownedPda("village", owner),
      permissionProgram: PERMISSION_PROGRAM_ID,
      ephemeralVault: EPHEMERAL_VAULT,
      magicProgram: MAGIC_PROGRAM_ID,
    })
    .instruction();
}

export async function postPositionIx(
  program: Program,
  payer: PublicKey,
  owner: PublicKey,
  sessionToken: PublicKey | null,
  x: number,
  y: number,
  facing: number,
): Promise<TransactionInstruction> {
  return program.methods
    .postPosition(x, y, MEADOW_ZONE, facing)
    .accountsPartial({
      payer,
      player: ownedPda("player", owner),
      presence: sharedPda("presence"),
      ...(sessionToken ? { sessionToken } : {}),
    })
    .instruction();
}

export async function gatherIx(
  program: Program,
  payer: PublicKey,
  owner: PublicKey,
  sessionToken: PublicKey | null,
  x: number,
  y: number,
): Promise<TransactionInstruction> {
  return program.methods
    .gather(BIRCH_NODE, x, y)
    .accountsPartial({
      payer,
      player: ownedPda("player", owner),
      inventory: ownedPda("inventory", owner),
      oracleQueue: ORACLE_QUEUE,
      ...(sessionToken ? { sessionToken } : {}),
      programIdentity: identityPda(),
      vrfProgram: VRF_PROGRAM_ID,
      slotHashes: SLOT_HASHES,
      systemProgram: systemProgram(),
    })
    .instruction();
}

function sessionAccounts(payer: PublicKey, owner: PublicKey, sessionToken: PublicKey | null) {
  return { payer, ...(sessionToken ? { sessionToken } : {}), player: ownedPda("player", owner) };
}

export async function crackIx(
  program: Program,
  payer: PublicKey,
  owner: PublicKey,
  sessionToken: PublicKey | null,
  slot: number,
): Promise<TransactionInstruction> {
  return program.methods
    .crack(slot)
    .accountsPartial({
      ...sessionAccounts(payer, owner, sessionToken),
      inventory: ownedPda("inventory", owner),
      purse: ownedPda("purse", owner),
      season: sharedPda("season"),
    })
    .instruction();
}

export async function crackRevealIx(
  program: Program,
  payer: PublicKey,
  owner: PublicKey,
  sessionToken: PublicKey | null,
  slot: number,
): Promise<TransactionInstruction> {
  return program.methods
    .crackReveal(slot)
    .accountsPartial({
      ...sessionAccounts(payer, owner, sessionToken),
      inventory: ownedPda("inventory", owner),
      purse: ownedPda("purse", owner),
      world: sharedPda("world"),
    })
    .instruction();
}

export async function enterDungeonIx(
  program: Program,
  payer: PublicKey,
  owner: PublicKey,
  sessionToken: PublicKey | null,
): Promise<TransactionInstruction> {
  return program.methods
    .enterDungeon()
    .accountsPartial({
      ...sessionAccounts(payer, owner, sessionToken),
      arena: ownedPda("arena", owner),
      oracleQueue: ORACLE_QUEUE,
      magicProgram: MAGIC_PROGRAM_ID,
      programIdentity: identityPda(),
      vrfProgram: VRF_PROGRAM_ID,
      slotHashes: SLOT_HASHES,
      systemProgram: systemProgram(),
    })
    .instruction();
}

export async function arenaInputIx(
  program: Program,
  payer: PublicKey,
  owner: PublicKey,
  sessionToken: PublicKey | null,
  dx: number,
  dy: number,
  attack: number,
  dash: number,
): Promise<TransactionInstruction> {
  return program.methods
    .arenaInput(dx, dy, attack, dash)
    .accountsPartial({ ...sessionAccounts(payer, owner, sessionToken), arena: ownedPda("arena", owner) })
    .instruction();
}

export async function exitDungeonIx(
  program: Program,
  payer: PublicKey,
  owner: PublicKey,
  sessionToken: PublicKey | null,
): Promise<TransactionInstruction> {
  return program.methods
    .exitDungeon()
    .accountsPartial({
      ...sessionAccounts(payer, owner, sessionToken),
      arena: ownedPda("arena", owner),
      purse: ownedPda("purse", owner),
      inventory: ownedPda("inventory", owner),
      magicProgram: MAGIC_PROGRAM_ID,
      taskContext: payer,
    })
    .instruction();
}

export async function claimIx(program: Program, wallet: PublicKey): Promise<TransactionInstruction> {
  return program.methods.claim().accountsPartial({ wallet, payout: payoutPda(), vault: sharedPda("vault") }).instruction();
}
