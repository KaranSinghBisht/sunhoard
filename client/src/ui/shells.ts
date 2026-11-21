import { create } from "zustand";

export interface ShellView {
  slot: number;
  flags: number;
  commitment: Uint8Array;
  key: Uint8Array;
}

interface ShellState {
  shells: ShellView[];
  setShells: (shells: ShellView[]) => void;
}

export const useShells = create<ShellState>((set) => ({
  shells: [],
  setShells: (shells) => set({ shells }),
}));
