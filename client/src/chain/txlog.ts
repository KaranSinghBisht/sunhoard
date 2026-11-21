import { create } from "zustand";

export interface TxRow {
  id: number;
  instruction: string;
  signature: string;
  latencyMs: number;
  url: string;
  ok: boolean;
}

interface TxState {
  rows: TxRow[];
  /** Every transaction that landed this visit, and their latencies added up. */
  landed: number;
  landedMs: number;
  add: (row: Omit<TxRow, "id">) => void;
}

let nextId = 1;

export const useTxLog = create<TxState>((set) => ({
  rows: [],
  landed: 0,
  landedMs: 0,
  add: (row) =>
    set((state) => ({
      rows: [{ ...row, id: nextId++ }, ...state.rows].slice(0, 12),
      landed: state.landed + (row.ok ? 1 : 0),
      landedMs: state.landedMs + (row.ok ? row.latencyMs : 0),
    })),
}));

export function resetTxLog(): void {
  nextId = 1;
  useTxLog.setState({ rows: [], landed: 0, landedMs: 0 });
}
