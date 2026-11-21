import { useEffect } from "react";
import { uiText } from "../content/text";
import { BEATS, BEAT_MS } from "../game/story/beats";
import { nextBeat, skipTale, useTale } from "../game/story/tale";
import { Typed } from "./Typed";

/** The opening: the tale's lines over the meadow while the camera travels. Space or a click moves on. */
export function Cinema() {
  const index = useTale((state) => state.beat);
  const beat = index === null ? undefined : BEATS[index];
  const open = index !== null;

  useEffect(() => {
    if (index === null) return undefined;
    const timer = window.setTimeout(nextBeat, BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skipTale();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!beat || index === null) return null;
  return (
    <section className="cinema" onClick={nextBeat}>
      {beat.sky ? <span className="noon-ring" aria-hidden="true" /> : null}
      <div className="caption">
        <Typed text={uiText(beat.text)} />
        <div className="caption-foot">
          <span className="pips" aria-hidden="true">
            {BEATS.map((each, at) => (
              <i key={each.text} className={at <= index ? "lit" : ""} />
            ))}
          </span>
          <span className="dim">{uiText("taleNext")}</span>
          <button
            type="button"
            className="quiet small"
            onClick={(event) => {
              event.stopPropagation();
              skipTale();
            }}
          >
            {uiText("taleSkip")}
          </button>
        </div>
      </div>
    </section>
  );
}
