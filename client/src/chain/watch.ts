import type { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { uiText } from "../content/text";
import { setChainFight } from "../game/fightFeed";
import { useShells, type ShellView } from "../ui/shells";
import { useHud } from "../ui/store";
import { arenaPhase } from "./arenaView";
import { asBytes, asNumber, field } from "./bytes";
import { ownedPda, sharedPda } from "./pdas";

let lastWood: number | null = null;

export function armChop(): void {
  lastWood = null;
}

type Stop = () => Promise<void>;

export async function pullAccounts(connection: Connection, program: Program, owner: PublicKey): Promise<void> {
  await readAccount(connection, program, ownedPda("player", owner), readPlayer);
  await readAccount(connection, program, ownedPda("purse", owner), readPurse);
  await readAccount(connection, program, ownedPda("inventory", owner), readPack);
  await readAccount(connection, program, sharedPda("season"), readSeason);
}

async function readAccount(
  connection: Connection,
  program: Program,
  account: PublicKey,
  read: (program: Program, data: Buffer) => void,
): Promise<void> {
  const info = await connection.getAccountInfo(account);
  if (info) read(program, info.data);
}

export function watchAccounts(connection: Connection, program: Program, owner: PublicKey): Stop {
  const ids = [
    connection.onAccountChange(ownedPda("player", owner), (info) => readPlayer(program, info.data)),
    connection.onAccountChange(ownedPda("purse", owner), (info) => readPurse(program, info.data)),
    connection.onAccountChange(ownedPda("inventory", owner), (info) => readPack(program, info.data)),
    connection.onAccountChange(sharedPda("season"), (info) => readSeason(program, info.data)),
  ];
  return async () => {
    for (const id of ids) {
      await connection.removeAccountChangeListener(id);
    }
  };
}

function readPlayer(program: Program, data: Buffer): void {
  const player = decode(program, "Player", data);
  const energy = asNumber(player?.energy);
  if (energy !== null) useHud.getState().setHud({ energy });
}

function readPurse(program: Program, data: Buffer): void {
  const purse = decode(program, "Purse", data);
  const glints = asBigint(purse?.glints);
  if (glints !== null) useHud.getState().setHud({ glints });
}

function readSeason(program: Program, data: Buffer): void {
  const season = decode(program, "Season", data);
  const pot = asBigint(season?.pot);
  if (pot !== null) useHud.getState().setHud({ pot });
}

export function readPack(program: Program, data: Buffer): number | null {
  const inventory = decode(program, "Inventory", data);
  const stacks = asNumber(inventory?.count);
  if (stacks !== null) useHud.getState().setHud({ stacks });
  const wood = woodQuantity(inventory);
  if (wood !== null && lastWood !== null && wood > lastWood) useHud.getState().setNote(uiText("bonus"));
  if (wood !== null) lastWood = wood;
  useShells.getState().setShells(shellsOf(inventory));
  return wood;
}

export function watchArena(connection: Connection, program: Program, owner: PublicKey): Stop {
  const id = connection.onAccountChange(ownedPda("arena", owner), (info) => readArena(program, info.data));
  void readAccount(connection, program, ownedPda("arena", owner), readArena);
  return async () => {
    await connection.removeAccountChangeListener(id);
  };
}

function readArena(program: Program, data: Buffer): void {
  const phase = arenaPhase(program, data);
  setChainFight(phase.fight, phase.waiting);
}

function shellsOf(inventory: Record<string, unknown> | null): ShellView[] {
  const slots = inventory?.slots;
  if (!Array.isArray(slots)) return [];
  const shells: ShellView[] = [];
  slots.forEach((slot, index) => {
    if (!slot || typeof slot !== "object") return;
    const record = slot as Record<string, unknown>;
    const flags = asNumber(field(record, "flags")) ?? 0;
    if ((flags & 3) === 0) return;
    shells.push({
      slot: index,
      flags,
      commitment: asBytes(field(record, "commitment")) ?? new Uint8Array(),
      key: asBytes(field(record, "revealedKey", "revealed_key")) ?? new Uint8Array(),
    });
  });
  return shells;
}

function woodQuantity(inventory: Record<string, unknown> | null): number | null {
  const slots = inventory?.slots;
  if (!Array.isArray(slots)) return null;
  let total = 0;
  for (const slot of slots) {
    if (!slot || typeof slot !== "object") continue;
    const kind = asNumber((slot as { kind?: unknown }).kind);
    const quantity = asNumber((slot as { quantity?: unknown }).quantity);
    if (kind === 1 && quantity) total += quantity;
  }
  return total;
}

function decode(program: Program, name: string, data: Buffer): Record<string, unknown> | null {
  try {
    return program.coder.accounts.decode(name, data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asBigint(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (value && typeof value === "object" && "toString" in value) {
    try {
      return BigInt(String(value));
    } catch {
      return null;
    }
  }
  return null;
}
