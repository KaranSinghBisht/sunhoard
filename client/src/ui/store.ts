import { create } from "zustand";

interface HudState {
  energy: number | null;
  glints: bigint | null;
  pot: bigint | null;
  stacks: number | null;
  note: string;
  sessionReady: boolean;
  busy: boolean;
  setHud: (patch: Partial<Omit<HudState, "setHud" | "setNote" | "setSession" | "setBusy">>) => void;
  setNote: (note: string) => void;
  setSession: (sessionReady: boolean) => void;
  setBusy: (busy: boolean) => void;
}

export const useHud = create<HudState>((set) => ({
  energy: null,
  glints: null,
  pot: null,
  stacks: null,
  note: "",
  sessionReady: false,
  busy: false,
  setHud: (patch) => set(patch),
  setNote: (note) => set({ note }),
  setSession: (sessionReady) => set({ sessionReady }),
  setBusy: (busy) => set({ busy }),
}));
