import { create } from "zustand";

/** One Coldfair listing, as the chain stores it. */
export interface ListingView {
  id: number;
  seller: string;
  price: string;
  expiresAt: number;
  kind: number;
  quantity: number;
  rarity: number;
  tone: number;
  grade: number;
  purityBp: number;
  shell: number;
  flags: number;
}

interface MarketState {
  listings: ListingView[];
  setListings: (listings: ListingView[]) => void;
}

export const useMarket = create<MarketState>((set) => ({
  listings: [],
  setListings: (listings) => set({ listings }),
}));

/** Flag bits, mirroring state/bits.rs. */
export const SEALED = 1 << 0;
export const CRACKING = 1 << 1;
export const LISTED = 1 << 4;
export const BOUND = 1 << 5;
export const FORGING = 1 << 7;
