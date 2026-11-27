// The Thawery's odds and the way a revealed key becomes a shell's contents.
// A hand mirror of the program, so the page can show the roll it did not make:
//   programs/sunhoard/src/logic/numbers.rs:22-35 (the tables)
//   programs/sunhoard/src/logic/seal.rs:46-140   (reveal_shell and its helpers)
//   programs/sunhoard/src/logic/roll.rs:5        (ppm_of)
// The page never decides a result with this: the chain's own items are the result, and
// `thawResult.ts` only shows these rolls when they agree with what the chain wrote.
import { sha256 } from "../../shared/sha";

/** numbers.rs:6 `PPM`. */
export const PPM = 1_000_000;
/** numbers.rs:22 `GRADE_PPM`: Dim, Glowing, Bright, Radiant, Blazing by shell (Small, Medium, Large, Crater, Boss). */
export const GRADE_PPM: readonly (readonly number[])[] = [
  [700_000, 220_000, 70_000, 9_000, 1_000],
  [450_000, 330_000, 150_000, 60_000, 10_000],
  [250_000, 350_000, 250_000, 120_000, 30_000],
  [0, 150_000, 450_000, 300_000, 100_000],
  [700_000, 250_000, 50_000, 0, 0],
];
/** numbers.rs:30 `DUST_PPM`: the chance a shell holds only frost dust. */
export const DUST_PPM: readonly number[] = [700_000, 500_000, 250_000, 0, 0];
/** numbers.rs:32 `DUST_HUNDREDTHS`: what frost dust pays, in Glint hundredths. */
export const DUST_HUNDREDTHS: readonly number[] = [200, 500, 1_000, 0, 0];
/** numbers.rs:35 `PAIR_PPM_LARGE`: a Large shell that holds a block holds a second one this often. */
export const PAIR_PPM_LARGE = 150_000;

/** ids.rs:52-57. */
export const SHELL_LARGE = 2;
export const SHELL_CRATER = 3;
export const SHELL_BOSS = 4;

const TWO_32 = 4_294_967_296;

export interface RolledGem {
  tone: number;
  grade: number;
  purityBp: number;
  pattern: number;
  /** Word 1 of the key as parts per million: the roll read against `GRADE_PPM`. */
  gradeRoll: number;
}

export interface Rolled {
  shell: number;
  /** Word 0 as parts per million, read against `DUST_PPM`. Null for a shell that never rolls for dust. */
  dustRoll: number | null;
  /** Frost dust paid, in Glint hundredths; 0 when the shell held a block. */
  dust: number;
  /** Word 6 as parts per million, read against `PAIR_PPM_LARGE`. Null unless a Large shell held a block. */
  pairRoll: number | null;
  gems: RolledGem[];
}

/** seal.rs:106 `word`: the key's little-endian u32 at `index`. */
function word(key: Uint8Array, index: number): number {
  const at = index * 4;
  return (key[at] | (key[at + 1] << 8) | (key[at + 2] << 16) | (key[at + 3] << 24)) >>> 0;
}

/** floor(n * scale / 2^32). Exact in a double: n * scale stays under 2^53 for every scale used here. */
function scaled(n: number, scale: number): number {
  return Math.floor((n * scale) / TWO_32);
}

/** roll.rs:5 `ppm_of`. */
export function ppmOf(n: number): number {
  return scaled(n, PPM);
}

/** seal.rs:111 `grade_of`: the first grade whose running total passes the roll. */
export function gradeOf(shell: number, roll: number): number {
  const table = GRADE_PPM[shell] ?? [];
  let total = 0;
  for (let grade = 0; grade < table.length; grade += 1) {
    total += table[grade];
    if (roll < total) return grade;
  }
  return 4;
}

/** seal.rs:90 `gem_from`. */
function gemFrom(key: Uint8Array, shell: number): RolledGem {
  const gradeRoll = ppmOf(word(key, 1));
  const purity = Math.floor((scaled(word(key, 2), 10_001) + scaled(word(key, 3), 10_001)) / 2);
  return {
    tone: scaled(word(key, 5), 4),
    grade: gradeOf(shell, gradeRoll),
    purityBp: Math.min(purity, 10_000),
    pattern: scaled(word(key, 4), 1_000),
    gradeRoll,
  };
}

/** seal.rs:99 `stretch`: the second block's key is sha256(key ‖ 0x01). */
function stretch(key: Uint8Array): Uint8Array {
  const more = new Uint8Array(33);
  more.set(key);
  more[32] = 1;
  return sha256(more);
}

/** seal.rs:46 `reveal_shell`. Null for a key or shell the program would refuse. */
export function rollShell(key: Uint8Array, shell: number): Rolled | null {
  if (key.length !== 32 || !Number.isInteger(shell) || shell < 0 || shell >= DUST_PPM.length) return null;
  if (shell === SHELL_CRATER) {
    return { shell, dustRoll: null, dust: 0, pairRoll: null, gems: [gemFrom(key, shell), gemFrom(stretch(key), shell)] };
  }
  if (shell === SHELL_BOSS) {
    return { shell, dustRoll: null, dust: 0, pairRoll: null, gems: [gemFrom(key, shell)] };
  }
  const dustRoll = ppmOf(word(key, 0));
  if (dustRoll < DUST_PPM[shell]) {
    return { shell, dustRoll, dust: DUST_HUNDREDTHS[shell], pairRoll: null, gems: [] };
  }
  const gems = [gemFrom(key, shell)];
  if (shell !== SHELL_LARGE) return { shell, dustRoll, dust: 0, pairRoll: null, gems };
  const pairRoll = ppmOf(word(key, 6));
  if (pairRoll < PAIR_PPM_LARGE) gems.push(gemFrom(stretch(key), shell));
  return { shell, dustRoll, dust: 0, pairRoll, gems };
}
