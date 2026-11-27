import type { CSSProperties } from "react";
import { uiText } from "../../content/text";
import { SEGMENT_NAME, STRIP_TITLE } from "./names";
import { hitIndex, landAt, restIn, percent, rollText, widths, type Strip } from "./strip";

/** idle: the roll is not known, the marker sweeps. run: it is slowing onto the roll. landed: it has stopped. */
export type StripState = "idle" | "run" | "landed";

/** A segment narrower than this share of the bar keeps its chance in the legend only. */
const LABEL_FROM_PCT = 11;

/**
 * One roll as a bar: every outcome as wide as its chance, and a marker that stops where
 * the roll fell. With no roll yet the marker only sweeps; it never rests on a guess.
 */
export function OddsStrip({ strip, state, compact = false }: { strip: Strip; state: StripState; compact?: boolean }) {
  const drawn = widths(strip.segments);
  const { segments, roll } = strip;
  // With the roll, the marker stops exactly on it. With only the chain's outcome, it rests inside the true segment.
  const asked = state === "idle" ? -1 : roll !== null ? hitIndex(segments, roll) : segments.findIndex((segment) => segment.id === strip.truth);
  const known = asked >= 0;
  const hit = asked;
  const land = !known ? 0 : roll !== null ? landAt(segments, roll) : restIn(segments, hit);
  const landed = state === "landed" && known;
  // The marker makes its last run from the far end, so it always has room to slow down.
  const far = land < 50 ? 100 : 0;
  const style = { "--land": `${land}%`, "--far": `${far}%`, "--near": `${100 - far}%` } as CSSProperties;
  return (
    <div className={`roll-strip is-${known ? state : "idle"}`}>
      <div className="roll-strip-head">
        <span>{uiText(STRIP_TITLE[strip.kind])}</span>
        {landed ? (
          <span className="roll-read">
            {roll !== null ? `${uiText("rollRolled")} ${rollText(roll)} ${uiText("rollOfMillion")}` : uiText("rollOnChain")}:{" "}
            {uiText(SEGMENT_NAME[segments[hit].id])}
          </span>
        ) : null}
      </div>
      <div className="roll-bar" style={style}>
        {strip.segments.map((segment, index) => (
          <span
            key={segment.id}
            className={`roll-seg seg-${segment.id}${landed && index === hit ? " hit" : ""}`}
            style={{ width: `${drawn[index]}%` }}
          >
            {drawn[index] >= LABEL_FROM_PCT ? percent(segment.ppm) : null}
          </span>
        ))}
        <i className="roll-marker" aria-hidden="true" />
      </div>
      {/* A shell with many rolls folds each strip's legend away once it has stopped, so all of them fit. */}
      <ul className="roll-legend" hidden={compact && landed}>
        {strip.segments.map((segment, index) => (
          <li key={segment.id} className={landed && index === hit ? "hit" : undefined}>
            <i className={`roll-swatch seg-${segment.id}`} aria-hidden="true" />
            {uiText(SEGMENT_NAME[segment.id])} {percent(segment.ppm)}
          </li>
        ))}
      </ul>
    </div>
  );
}
