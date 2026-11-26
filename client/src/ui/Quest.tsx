import { useEffect } from "react";
import { uiText } from "../content/text";
import { STEPS } from "../game/story/quest";
import { closeWalk, skipWalk, useTale } from "../game/story/tale";

/** How long the tracker stays up to say the first night is done, ms. */
const FAREWELL_MS = 10000;

/**
 * The first night: what to do next, while the trail on the meadow shows where.
 * `narrow` keeps it inside the dark margin beside the cellar room.
 */
export function Quest({ narrow }: { narrow: boolean }) {
  const step = useTale((state) => state.step);
  const ended = useTale((state) => state.ended);

  useEffect(() => {
    if (ended !== "done") return undefined;
    const timer = window.setTimeout(closeWalk, FAREWELL_MS);
    return () => window.clearTimeout(timer);
  }, [ended]);

  const now = STEPS[step];
  if (narrow && now?.id !== "fight") return null;
  if (!now) {
    if (ended !== "done") return null;
    return (
      <aside className={narrow ? "panel quest done narrow" : "panel quest done"} role="status">
        <h2>{uiText("questTitle")}</h2>
        <p>{uiText("questDone")}</p>
      </aside>
    );
  }
  return (
    <aside className={narrow ? "panel quest narrow" : "panel quest"} role="status">
      <h2>
        {uiText("questTitle")}
        <span className="dim">
          {step + 1} / {STEPS.length}
        </span>
      </h2>
      <p>{uiText(now.text)}</p>
      <button type="button" className="quiet small" onClick={skipWalk}>
        {uiText("questSkip")}
      </button>
    </aside>
  );
}
