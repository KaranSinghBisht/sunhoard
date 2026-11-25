import { create } from "zustand";

/** One lantern post, as the chain stores it. */
export interface PostView {
  index: number;
  built: boolean;
  hasBlock: boolean;
  tone: number;
  grade: number;
  purityBp: number;
  pattern: number;
}

export interface VillagerView {
  index: number;
  id: string;
  profession: number;
  joined: boolean;
  wanderer: boolean;
  bound: boolean;
}

interface VillageState {
  warmth: number;
  beds: number;
  workstations: number;
  bellBusy: boolean;
  posts: PostView[];
  villagers: VillagerView[];
  setVillage: (patch: {
    warmth: number;
    beds: number;
    workstations: number;
    bellBusy: boolean;
    posts: PostView[];
    villagers: VillagerView[];
  }) => void;
}

export const useVillage = create<VillageState>((set) => ({
  warmth: 0,
  beds: 0,
  workstations: 0,
  bellBusy: false,
  posts: [],
  villagers: [],
  setVillage: (patch) => set(patch),
}));
