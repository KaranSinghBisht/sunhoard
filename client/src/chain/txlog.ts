import { create } from "zustand";

type Status = "pending" | "confirmed" | "failed";
export interface TxRow {
  id: number;
  instruction: string;
  signature: string;
  latencyMs: number;
  url: string;
  ok: boolean;
  status: Status;
}

type NewRow = Omit<TxRow, "id" | "status"> & { status?: Status };
interface TxState {
  rows: TxRow[];
  landed: number;
  landedMs: number;
  add(row: NewRow): number;
  settle(id: number, status: Status, latencyMs: number): void;
}

let nextId = 1;
export const useTxLog = create<TxState>((set) => ({
  rows: [],
  landed: 0,
  landedMs: 0,
  add(row) {
    const id = nextId++;
    const status = row.status ?? (row.ok ? "confirmed" : "failed");
    set((state) => ({
      rows: [{ ...row, status, id }, ...state.rows].slice(0, 12),
      landed: state.landed + Number(row.ok),
      landedMs: state.landedMs + (row.ok ? row.latencyMs : 0),
    }));
    return id;
  },
  settle(id, status, latencyMs) {
    set((state) => {
      if (!state.rows.some(row => row.id === id && row.status === "pending")) return state;
      const ok = status === "confirmed";
      return {
        rows: state.rows.map(row => row.id === id ? { ...row, status, ok, latencyMs } : row),
        landed: state.landed + Number(ok),
        landedMs: state.landedMs + (ok ? latencyMs : 0),
      };
    });
  },
}));

export function resetTxLog(): void {
  useTxLog.setState({ rows: [], landed: 0, landedMs: 0 });
}
