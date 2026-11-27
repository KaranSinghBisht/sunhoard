import { create } from "zustand";

/** A window that opens over the game screen. Only one is open at a time. */
export type PanelId = "pack" | "coldfair" | "thaw" | "cheat" | "guide";

interface PanelState {
  panel: PanelId | null;
  /** The rollup feed is a strip in a corner of the game, so it stays up while you play. */
  feed: boolean;
  toggle: (id: PanelId) => void;
  open: (id: PanelId) => void;
  close: () => void;
  toggleFeed: () => void;
  reset: () => void;
}

export const usePanel = create<PanelState>((set) => ({
  panel: null,
  feed: false,
  toggle: (id) => set((state) => ({ panel: state.panel === id ? null : id })),
  open: (id) => set({ panel: id }),
  close: () => set({ panel: null }),
  toggleFeed: () => set((state) => ({ feed: !state.feed })),
  reset: () => set({ panel: null, feed: false }),
}));
