import { create } from "zustand";

export interface SlayerView {
  wallet: string;
  damage: bigint;
  isKiller: boolean;
  clearedT1: boolean;
  glintAward: bigint;
  glintsClaimed: boolean;
}

export interface PresenceView {
  player: string;
  x: number;
  y: number;
  zone: number;
  facing: number;
  updated: number;
}

export interface WorldState {
  seasonNumber: number;
  phase: number;
  phaseStarted: number;
  phaseEnds: number;
  lastTick: number;
  burned: bigint;
  totalDamage: bigint;
  killer: string;
  emberHolder: string;
  wyrmName: string;
  sealedLegendaries: number;
  playerCount: number;
  demoMode: boolean;
  hasEmber: boolean;
  slayers: SlayerView[];
  goodA: number;
  goodB: number;
  wantsUntil: number;
  bounties: number[];
  presence: PresenceView[];
  setSeason: (patch: Partial<Omit<WorldState, "setSeason" | "setPrices" | "setPresence">>) => void;
  setPrices: (goodA: number, goodB: number, wantsUntil: number, bounties: number[]) => void;
  setPresence: (presence: PresenceView[]) => void;
}

export const useWorld = create<WorldState>((set) => ({
  seasonNumber: 0,
  phase: 0,
  phaseStarted: 0,
  phaseEnds: 0,
  lastTick: 0,
  burned: 0n,
  totalDamage: 0n,
  killer: "",
  emberHolder: "",
  wyrmName: "",
  sealedLegendaries: 0,
  playerCount: 0,
  demoMode: false,
  hasEmber: false,
  slayers: [],
  goodA: 0,
  goodB: 0,
  wantsUntil: 0,
  bounties: [],
  presence: [],
  setSeason: (patch) => set(patch),
  setPrices: (goodA, goodB, wantsUntil, bounties) => set({ goodA, goodB, wantsUntil, bounties }),
  setPresence: (presence) => set({ presence }),
}));
