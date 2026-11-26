import { create } from "zustand";

export interface ShellView {
  slot: number;
  flags: number;
  commitment: Uint8Array;
  key: Uint8Array;
  /** Small 0, Medium 1, Large 2, Crater 3, Boss 4. */
  size: number;
}

/** The Thawery's fee by shell size, in Glint hundredths: the table in `logic/seal.rs`. */
const THAW_FEES = [500n, 1200n, 3000n, 0n, 0n];

export function thawFee(size: number): bigint {
  return THAW_FEES[size] ?? 0n;
}

interface ShellState {
  shells: ShellView[];
  setShells: (shells: ShellView[]) => void;
}

export const useShells = create<ShellState>((set) => ({
  shells: [],
  setShells: (shells) => set({ shells }),
}));
