import { create } from "zustand";

/** The anvil's heat per target rarity, as the chain stores it. */
interface AnvilState {
  heat: number[];
  setHeat: (heat: number[]) => void;
}

export const useAnvil = create<AnvilState>((set) => ({
  heat: [],
  setHeat: (heat) => set({ heat }),
}));

export const RARITY_NAME = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
export const RARITY_PRICE_BP = [10_000, 24_000, 60_000, 160_000, 500_000];
export const GEAR_BASE = [100, 500, 800];

/** The strike plan, mirroring logic/anvil.rs: odds in basis points, the fee in hundredths. */
export function planStrike(
  material: number,
  rarity: number,
  inputsValue: number,
  heat: number,
): { pre: number; odds: number; fee: number } | null {
  if (rarity >= 4) return null;
  const target = (GEAR_BASE[material] * RARITY_PRICE_BP[rarity + 1]) / 10_000;
  if (target === 0) return null;
  const pre = (inputsValue * 8_000) / target;
  if (pre < 3_000) return null;
  const odds = Math.min(8_000, pre + Math.min(heat, 15) * 100);
  const fee = (target * 500) / 10_000;
  return { pre, odds, fee };
}
