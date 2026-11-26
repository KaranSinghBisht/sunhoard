// The vault keeps its rent reserve. Only its remaining devnet lamports fund awards.
import type { Connection, PublicKey } from "@solana/web3.js";
import { payoutPda, sharedPda } from "./pdas";
import { openProgram } from "./program";

export interface Prize {
  owner: string;
  season: number;
  funded: bigint;
  amount: bigint;
  claimed: boolean;
  until: number;
}

interface RecordData {
  seasonNumber: { toString(): string };
  len: number;
  claimUntil: number;
  rows: Array<{ wallet: PublicKey; amount: { toString(): string }; flags: number }>;
}

export async function readPrize(connection: Connection, owner: PublicKey): Promise<Prize> {
  const [vault, payout] = await connection.getMultipleAccountsInfo([sharedPda("vault"), payoutPda()], "confirmed");
  if (!vault || !payout) throw new Error("Prize accounts unavailable");
  const rent = await connection.getMinimumBalanceForRentExemption(vault.data.length);
  const data = openProgram(connection).coder.accounts.decode<RecordData>("payout", payout.data);
  const row = data.rows.slice(0, data.len).find((item) => item.wallet.equals(owner));
  return {
    owner: owner.toBase58(), season: Number(data.seasonNumber.toString()),
    funded: BigInt(Math.max(0, vault.lamports - rent)), amount: BigInt(row?.amount.toString() ?? "0"),
    claimed: Boolean(row && (row.flags & 1)), until: data.claimUntil,
  };
}

export function formatSol(lamports: bigint): string {
  const frac = (lamports % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${lamports / 1_000_000_000n}${frac ? `.${frac}` : ""}`;
}
