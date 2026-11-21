// What the story is doing right now: the opening's line, the first-night step, and who is talking.
// The Phaser scenes and the React overlays both read and drive this one store.
import { create } from "zustand";
import { log } from "../../chain/log";
import type { UiKey } from "../../content/text";
import { BEATS } from "./beats";
import { STEPS, advance, type QuestEvent } from "./quest";

const SEEN_KEY = "sunhoard.firstNight";
/** A key press this soon after a line appears is the press that brought it up, so it is ignored. */
const MIN_BEAT_MS = 350;

export interface Talk {
  who: UiKey;
  face: string;
  lines: readonly UiKey[];
  index: number;
}

interface TaleState {
  /** The opening's current line, or null when it is not playing. */
  beat: number | null;
  beatAt: number;
  /** The first-night step; STEPS.length once the walk is over. */
  step: number;
  /** "done" for a few seconds after the last step, so the tracker can say so. */
  ended: "done" | null;
  talk: Talk | null;
  /** Counts each time the opening starts; the scene puts the Keeper back at the road's end when it changes. */
  arrivals: number;
}

function seen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch (err) {
    log(`first-night flag unreadable: ${String(err)}`);
    return false;
  }
}

function remember(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch (err) {
    log(`first-night flag not saved: ${String(err)}`);
  }
}

export const useTale = create<TaleState>(() => ({
  beat: null,
  beatAt: 0,
  step: STEPS.length,
  ended: null,
  talk: null,
  arrivals: 0,
}));

/** True until this browser has finished or skipped the first night. */
export function firstVisit(): boolean {
  return !seen();
}

/** Starts the opening, and the first-night walk after it. */
export function beginTale(): void {
  const { arrivals } = useTale.getState();
  useTale.setState({ beat: 0, beatAt: Date.now(), step: 0, ended: null, talk: null, arrivals: arrivals + 1 });
}

export function nextBeat(): void {
  const { beat, beatAt } = useTale.getState();
  if (beat === null || Date.now() - beatAt < MIN_BEAT_MS) return;
  const next = beat + 1;
  useTale.setState({ beat: next < BEATS.length ? next : null, beatAt: Date.now() });
}

export function skipTale(): void {
  useTale.setState({ beat: null });
}

/** Something happened in the game; moves the walk on if that was what it was waiting for. */
export function tell(event: QuestEvent): void {
  const { beat, step } = useTale.getState();
  if (beat !== null || step >= STEPS.length) return;
  const next = advance(step, event);
  if (next === step) return;
  const over = next >= STEPS.length;
  if (over) remember();
  useTale.setState({ step: next, ended: over ? "done" : null });
}

export function skipWalk(): void {
  remember();
  useTale.setState({ step: STEPS.length, ended: null });
}

export function closeWalk(): void {
  useTale.setState({ ended: null });
}

export function speak(who: UiKey, face: string, lines: readonly UiKey[]): void {
  if (lines.length === 0) return;
  useTale.setState({ talk: { who, face, lines, index: 0 } });
}

export function nextLine(): void {
  const { talk } = useTale.getState();
  if (!talk) return;
  if (talk.index + 1 < talk.lines.length) {
    useTale.setState({ talk: { ...talk, index: talk.index + 1 } });
    return;
  }
  useTale.setState({ talk: null });
  tell({ kind: "talked" });
}

/** The step the trail should lead to, if the walk is on and the opening is over. */
export function currentStep(): (typeof STEPS)[number] | undefined {
  const { beat, step } = useTale.getState();
  return beat === null ? STEPS[step] : undefined;
}
