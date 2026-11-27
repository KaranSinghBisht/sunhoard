// An odds strip: the outcomes of one roll laid end to end, each as wide as its chance,
// and the place on it where a roll lands. Pure maths; the drawing is in OddsStrip.tsx.
import { DUST_PPM, GRADE_PPM, PAIR_PPM_LARGE, PPM, SHELL_CRATER, SHELL_LARGE, type Rolled } from "./thawOdds";

export type SegmentId = "dust" | "block" | "second" | "none" | "g0" | "g1" | "g2" | "g3" | "g4";
export type StripKind = "dust" | "grade" | "gradeFirst" | "gradeSecond" | "pair";

export interface Segment {
  id: SegmentId;
  /** The outcome's chance in parts per million, straight from the program's table. */
  ppm: number;
}

export interface Strip {
  kind: StripKind;
  segments: Segment[];
  /** The roll in parts per million, or null while it is not known. */
  roll: number | null;
  /**
   * The outcome the chain wrote, for when the roll itself cannot be read (a shell of frost
   * dust keeps no key in the pack). The marker then stops on this segment and no roll is quoted.
   */
  truth?: SegmentId;
}

/**
 * A 0.1% outcome would be a third of a pixel wide. Every segment is drawn at least this
 * wide so it can be seen; its label always carries the true chance.
 */
export const MIN_WIDTH_PCT = 5;

const GRADE_IDS: SegmentId[] = ["g0", "g1", "g2", "g3", "g4"];

/** "70%", "0.9%", "66.66%": the chance as the table has it, with no rounding beyond two places. */
export function percent(ppm: number): string {
  return `${(ppm / 10_000).toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** "712,345": a roll out of a million. */
export function rollText(roll: number): string {
  return String(roll).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** The segment a roll falls in: the first whose running total passes it, as `grade_of` reads its table. */
export function hitIndex(segments: Segment[], roll: number): number {
  let total = 0;
  for (let index = 0; index < segments.length; index += 1) {
    total += segments[index].ppm;
    if (roll < total) return index;
  }
  return segments.length - 1;
}

/** Each segment's drawn width in percent of the bar. They add up to 100. */
export function widths(segments: Segment[], minPct = MIN_WIDTH_PCT): number[] {
  const raw = segments.map((segment) => Math.max((segment.ppm / PPM) * 100, minPct));
  const total = raw.reduce((sum, width) => sum + width, 0);
  return total > 0 ? raw.map((width) => (width / total) * 100) : raw;
}

/** Where the marker stops, in percent of the bar: as far into the true segment as the roll is into its range. */
export function landAt(segments: Segment[], roll: number, minPct = MIN_WIDTH_PCT): number {
  const index = hitIndex(segments, roll);
  const drawn = widths(segments, minPct);
  const before = segments.slice(0, index).reduce((sum, segment) => sum + segment.ppm, 0);
  const span = segments[index]?.ppm ?? 0;
  const into = span > 0 ? Math.min(Math.max((roll - before) / span, 0), 1) : 0.5;
  const left = drawn.slice(0, index).reduce((sum, width) => sum + width, 0);
  return left + into * (drawn[index] ?? 0);
}

export function dustStrip(shell: number, roll: number | null): Strip {
  const dust = DUST_PPM[shell] ?? 0;
  return { kind: "dust", roll, segments: [{ id: "dust", ppm: dust }, { id: "block", ppm: PPM - dust }] };
}

/** Grades the shell can never hold (a Crater shell is never Dim) are left off the strip. */
export function gradeStrip(shell: number, roll: number | null, kind: StripKind = "grade"): Strip {
  const table = GRADE_PPM[shell] ?? [];
  const segments = table.map((ppm, grade) => ({ id: GRADE_IDS[grade], ppm })).filter((segment) => segment.ppm > 0);
  return { kind, roll, segments };
}

export function pairStrip(roll: number | null): Strip {
  return { kind: "pair", roll, segments: [{ id: "second", ppm: PAIR_PPM_LARGE }, { id: "none", ppm: PPM - PAIR_PPM_LARGE }] };
}

/** True when the shell rolls for dust at all (Crater and Boss shells never do). */
export function rollsForDust(shell: number): boolean {
  return (DUST_PPM[shell] ?? 0) > 0;
}

/** The first roll a shell makes, with no result yet: what the strip shows while the chain works. */
export function waitingStrip(shell: number): Strip {
  return rollsForDust(shell) ? dustStrip(shell, null) : gradeStrip(shell, null, shell === SHELL_CRATER ? "gradeFirst" : "grade");
}

/** Every roll the program made for this shell, in the order it made them. */
export function stripsFor(rolled: Rolled): Strip[] {
  const out: Strip[] = [];
  if (rolled.dustRoll !== null) out.push(dustStrip(rolled.shell, rolled.dustRoll));
  const [first, second] = rolled.gems;
  const pair = rolled.pairRoll !== null || rolled.gems.length > 1;
  if (first) out.push(gradeStrip(rolled.shell, first.gradeRoll, pair && second ? "gradeFirst" : "grade"));
  if (rolled.pairRoll !== null) out.push(pairStrip(rolled.pairRoll));
  if (second) out.push(gradeStrip(rolled.shell, second.gradeRoll, "gradeSecond"));
  return out;
}

/** How far into its segment the marker rests when only the outcome is known: clear of the label in the middle. */
const REST_INTO = 0.3;

/** Where the marker rests inside a segment when only the outcome is known, in percent of the bar. */
export function restIn(segments: Segment[], index: number, minPct = MIN_WIDTH_PCT): number {
  const drawn = widths(segments, minPct);
  return drawn.slice(0, index).reduce((sum, width) => sum + width, 0) + (drawn[index] ?? 0) * REST_INTO;
}

/**
 * The same strips from the outcome alone: what the chain put in the pack, with no rolls.
 * `grades` are the new blocks' grades; none means frost dust.
 */
export function chainStrips(shell: number, grades: number[]): Strip[] {
  const out: Strip[] = [];
  const two = grades.length > 1;
  if (rollsForDust(shell)) out.push({ ...dustStrip(shell, null), truth: grades.length > 0 ? "block" : "dust" });
  if (grades.length > 0) out.push({ ...gradeStrip(shell, null, two ? "gradeFirst" : "grade"), truth: GRADE_IDS[grades[0]] });
  if (shell === SHELL_LARGE && grades.length > 0) out.push({ ...pairStrip(null), truth: two ? "second" : "none" });
  if (two) out.push({ ...gradeStrip(shell, null, "gradeSecond"), truth: GRADE_IDS[grades[1]] });
  return out;
}
