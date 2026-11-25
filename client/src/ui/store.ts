import { create } from "zustand";

interface HudState {
  energy: number | null;
  glints: bigint | null;
  pot: bigint | null;
  stacks: number | null;
  note: string;
  sessionReady: boolean;
  busy: boolean;
  /** A spark sits within scoop reach, in the Crater. */
  sparkNear: boolean;
  /** Old Gloam is dead: the season has a killer and Spring has begun. */
  sunFree: boolean;
  setHud: (patch: Partial<Omit<HudState, "setHud" | "setNote" | "setSession" | "setBusy" | "setSparkNear">>) => void;
  setNote: (note: string) => void;
  setSession: (sessionReady: boolean) => void;
  setBusy: (busy: boolean) => void;
  setSparkNear: (sparkNear: boolean) => void;
}

export const useHud = create<HudState>((set) => ({
  energy: null,
  glints: null,
  pot: null,
  stacks: null,
  note: "",
  sessionReady: false,
  busy: false,
  sparkNear: false,
  sunFree: false,
  setHud: (patch) => set(patch),
  setNote: (note) => set({ note }),
  setSession: (sessionReady) => set({ sessionReady }),
  setBusy: (busy) => set({ busy }),
  setSparkNear: (sparkNear) => set({ sparkNear }),
}));
