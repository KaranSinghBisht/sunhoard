import { uiText, type UiKey } from "../content/text";
import { firstVisit } from "../game/story/tale";

const STORY: UiKey[] = ["intro1", "intro6", "intro2", "keeperLine"];
const KEYS: Array<[key: UiKey, does: UiKey]> = [
  ["keyMove", "keyMoveDoes"],
  ["keyUse", "keyUseDoes"],
  ["keyPack", "keyPackDoes"],
];

/**
 * The title card, over the living meadow drifting by behind it.
 * `onBegin(true)` plays the opening and the first-night walk; a first visit always gets them.
 * `canRetell` is false while the cellar is on the canvas, because the opening is told over the meadow.
 */
export function Guide({ onBegin, canRetell }: { onBegin: (retell: boolean) => void; canRetell: boolean }) {
  return (
    <section className="guide">
      <div className="card">
        <p className="kicker">{uiText("tagline")}</p>
        <h1>{uiText("title")}</h1>
        <div className="story">
          {STORY.map((key) => (
            <p key={key}>{uiText(key)}</p>
          ))}
        </div>
        <dl className="keys">
          {KEYS.map(([key, does]) => (
            <div key={key}>
              <dt>{uiText(key)}</dt>
              <dd>{uiText(does)}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="begin" onClick={() => onBegin(false)} autoFocus>
          {uiText("begin")}
        </button>
        {firstVisit() || !canRetell ? null : (
          <button type="button" className="quiet" onClick={() => onBegin(true)}>
            {uiText("taleAgain")}
          </button>
        )}
        <p className="built">{uiText("built")}</p>
      </div>
    </section>
  );
}
