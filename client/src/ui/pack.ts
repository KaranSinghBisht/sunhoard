import { create } from "zustand";

/** One pack slot as the chain stores it. */
export interface SlotView {
  slot: number;
  id: string;
  kind: number;
  quantity: number;
  rarity: number;
  traits: Array<{ id: number; tier: number }>;
  tone: number;
  grade: number;
  purityBp: number;
  pattern: number;
  shell: number;
  flags: number;
}

interface PackState {
  slots: SlotView[];
  equipped: number | null;
  setPack: (slots: SlotView[], equipped: number | null) => void;
}

export const usePack = create<PackState>((set) => ({
  slots: [],
  equipped: null,
  setPack: (slots, equipped) => set({ slots, equipped }),
}));

/** Flag bits, mirroring state/bits.rs. */
export const SEALED = 1 << 0;
export const CRACKING = 1 << 1;
export const PRISTINE = 1 << 2;
export const LISTED = 1 << 4;
export const BOUND = 1 << 5;

/** Kind ids, mirroring logic/ids.rs. */
export const KIND_FOOD = 5;
export const KIND_MEAL = 9;
export const GEAR_FIRST = 12;
export const GEAR_LAST = 19;

export function isGear(kind: number): boolean {
  return kind >= GEAR_FIRST && kind <= GEAR_LAST;
}

/**
 * The gear in hand. A new keeper's equipped slot is 0, which holds their first
 * Magic Block: the chain fights with the starter axe then, so nothing is held.
 */
export function heldItem(state: Pick<PackState, "slots" | "equipped">): SlotView | undefined {
  const item = state.slots.find((slot) => slot.slot === state.equipped);
  return item && isGear(item.kind) ? item : undefined;
}
