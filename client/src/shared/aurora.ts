// The aurora: ten minutes in every thirty, by the clock, when a gather's roll
// for an aberration is more than three times likelier. Mirrors
// `AURORA_CYCLE_SECS`, `AURORA_UP_SECS`, `CLEAR_ABERRATION_PPM` and
// `AURORA_ABERRATION_PPM` in programs/sunhoard/src/logic/numbers.rs.
export const AURORA_CYCLE_SECS = 30 * 60;
export const AURORA_UP_SECS = 10 * 60;
export const CLEAR_ONE_IN = 400;
export const AURORA_ONE_IN = 120;

export interface Aurora {
  up: boolean;
  /** Seconds until it rises or sets. */
  left: number;
  /** A gather's roll is an aberration one time in this many. */
  oneIn: number;
}

export function auroraAt(unixSecs: number): Aurora {
  const into = ((Math.floor(unixSecs) % AURORA_CYCLE_SECS) + AURORA_CYCLE_SECS) % AURORA_CYCLE_SECS;
  const up = into < AURORA_UP_SECS;
  return { up, left: (up ? AURORA_UP_SECS : AURORA_CYCLE_SECS) - into, oneIn: up ? AURORA_ONE_IN : CLEAR_ONE_IN };
}

export function auroraNow(): Aurora {
  return auroraAt(Date.now() / 1000);
}
