// One gather at a time. The chain refuses a second chop while the first one's
// roll is pending and for three seconds after it, so the page holds Space back
// for exactly that long and shows why, instead of sending chops to be refused.
import { create } from "zustand";

/** idle: Space works. swing: the chop is on its way. roll: the yield landed, the VRF roll has not. rest: the chain's cooldown. */
export type GatherPhase = "idle" | "swing" | "roll" | "rest";
export type PopTone = "gain" | "bonus" | "miss";

export interface GatherPop {
  seq: number;
  node: number;
  text: string;
  tone: PopTone;
}

interface GatherState {
  phase: GatherPhase;
  node: number;
  /** When the chain's cooldown is over, ms. */
  readyAt: number;
  /** When a roll that never arrived is given up on, ms. */
  rollBy: number;
  pop: GatherPop | null;
}

/** `GATHER_COOLDOWN_SECS` is 3 on chain, counted in whole seconds; the margin covers the rounding. */
const COOLDOWN_MS = 3200;
/** The chain releases a roll that never arrived after 30 s. */
const ROLL_WAIT_MS = 30_000;

export const useGather = create<GatherState>(() => ({ phase: "idle", node: 0, readyAt: 0, rollBy: 0, pop: null }));

function pop(node: number, text: string, tone: PopTone): GatherPop {
  return { seq: (useGather.getState().pop?.seq ?? 0) + 1, node, text, tone };
}

/** False when a gather is already under way: the caller sends nothing. */
export function beginSwing(node: number): boolean {
  if (useGather.getState().phase !== "idle") return false;
  useGather.setState({ phase: "swing", node });
  return true;
}

export function swingFailed(): void {
  useGather.setState({ phase: "idle" });
}

/** The chop landed and its base yield is in the pack; the roll is still out. */
export function swingLanded(text: string, now = Date.now()): void {
  const { node } = useGather.getState();
  useGather.setState({ phase: "roll", readyAt: now + COOLDOWN_MS, rollBy: now + ROLL_WAIT_MS, pop: pop(node, text, "gain") });
}

/** The roll arrived: `bonus` is what it added, or null when it added nothing. */
export function rollLanded(text: string, bonus: boolean, now = Date.now()): void {
  const { node, readyAt, phase } = useGather.getState();
  if (phase !== "roll") return;
  useGather.setState({ phase: now >= readyAt ? "idle" : "rest", pop: pop(node, text, bonus ? "bonus" : "miss") });
}

/** Called every frame: ends the cooldown, and gives up on a roll that never came. */
export function tickGather(now = Date.now()): void {
  const { phase, readyAt, rollBy } = useGather.getState();
  if (phase === "rest" && now >= readyAt) useGather.setState({ phase: "idle" });
  if (phase === "roll" && now >= rollBy) useGather.setState({ phase: "idle" });
}

export function resetGather(): void {
  useGather.setState({ phase: "idle", node: 0, readyAt: 0, rollBy: 0, pop: null });
}
