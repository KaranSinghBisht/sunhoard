import { uiText, type UiKey } from "../content/text";
import { ItemIcon } from "./ItemIcon";

/** The loop in five lines, each with the icon of the thing it is about. */
const STEPS: Array<{ text: UiKey; kind: number; shell?: boolean }> = [
  { text: "guide1", kind: 1 },
  { text: "guide2", kind: 12 },
  { text: "guide3", kind: 16 },
  { text: "guide4", kind: 0, shell: true },
  { text: "guide5", kind: 19 },
];

const KEYS: UiKey[] = ["guideKeyMove", "guideKeyUse", "guideKeyDash", "guideKeyPack"];

function icon(step: { kind: number; shell?: boolean }) {
  return { kind: step.kind, flags: step.shell ? 1 : 0, shell: 3, tone: 0, grade: 0, purityBp: 0 };
}

/** What to do and why, for a keeper who has just walked in. */
export function GuidePanel() {
  return (
    <aside className="panel guide-panel">
      <h2>{uiText("guide")}</h2>
      <h3>{uiText("guideLoop")}</h3>
      <ol className="steps">
        {STEPS.map((step) => (
          <li key={step.text}>
            <ItemIcon item={icon(step)} size={32} />
            <span>{uiText(step.text)}</span>
          </li>
        ))}
      </ol>
      <h3>{uiText("guideKeys")}</h3>
      <ul className="keys-list">
        {KEYS.map((key) => (
          <li key={key}>{uiText(key)}</li>
        ))}
      </ul>
    </aside>
  );
}
