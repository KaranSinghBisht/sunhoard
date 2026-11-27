import type { CSSProperties } from "react";
import { uiText } from "../../content/text";
import { percent } from "./strip";
import { hitSweep, rimPoint, slicePath, stopTurn } from "./wheel";

/** plan: still, showing the odds. spin: the roll is out. land: slowing onto the result. done: stopped on it. */
export type WheelState = "plan" | "spin" | "land" | "done";

const SIZE = 132;
const CENTRE = SIZE / 2;
const RADIUS = 60;
const TICKS = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];

interface WheelProps {
  /** The strike's chance in basis points, from `planStrike`; null when there is no strike to plan. */
  oddsBp: number | null;
  state: WheelState;
  /** The chain's result. Only read once the wheel is landing or done. */
  hit: boolean;
  /** 0..1: where inside the true slice the pointer rests. For show only. */
  rest: number;
}

function Disc({ oddsBp }: { oddsBp: number }) {
  const sweep = hitSweep(oddsBp);
  return (
    <svg className="roll-disc" viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
      <circle className="rim" cx={CENTRE} cy={CENTRE} r={RADIUS + 4} />
      <path className="slice-miss" d={slicePath(sweep, 360, RADIUS, CENTRE)} />
      <path className="slice-hit" d={slicePath(0, sweep, RADIUS, CENTRE)} />
      {TICKS.map((angle) => {
        const from = rimPoint(angle, RADIUS - 5, CENTRE);
        const to = rimPoint(angle, RADIUS, CENTRE);
        return <line key={angle} className="tick" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}
    </svg>
  );
}

/**
 * The strike as a wheel. The gold slice is the real chance of a hit. While the roll is
 * out it only spins; it stops with the pointer in the slice the chain chose.
 */
export function StrikeWheel({ oddsBp, state, hit, rest }: WheelProps) {
  if (oddsBp === null) {
    return (
      <div className="roll-wheel is-empty" aria-hidden="true">
        <svg className="roll-disc" viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
          <circle className="rim" cx={CENTRE} cy={CENTRE} r={RADIUS + 4} />
          <circle className="slice-miss" cx={CENTRE} cy={CENTRE} r={RADIUS} />
        </svg>
        <span className="roll-hub">?</span>
      </div>
    );
  }
  const settled = state === "land" || state === "done";
  const style = (settled ? { "--stop": `${stopTurn(oddsBp, hit, rest)}deg` } : {}) as CSSProperties;
  const verdict = state === "done" ? (hit ? "hit" : "miss") : "";
  const label = `${uiText("rollHitLine")} ${percent(oddsBp * 100)}, ${uiText("rollMissLine")} ${percent((10_000 - oddsBp) * 100)}`;
  return (
    <div className={`roll-wheel is-${state} ${verdict}`} style={style} role="img" aria-label={label}>
      <Disc oddsBp={oddsBp} />
      <i className="roll-pointer" aria-hidden="true" />
      <span className="roll-hub">{state === "done" ? uiText(hit ? "rollHit" : "rollMiss") : percent(oddsBp * 100)}</span>
    </div>
  );
}
