import { create } from "zustand";

/** The anvil's heat per target rarity, as the chain stores it. */
interface AnvilState {
  heat: number[];
  heatAt: number;
  setHeat: (heat: number[], heatAt?: number) => void;
}

export const useAnvil = create<AnvilState>((set) => ({
  heat: [],
  heatAt: 0,
  setHeat: (heat, heatAt = 0) => set({ heat, heatAt }),
}));
