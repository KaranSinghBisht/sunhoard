import { useState } from "react";
import { peekAsOwner, peekAsStranger, type Peek } from "../chain/cheat";
import { playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { uiText, type UiKey } from "../content/text";
import { useHud } from "./store";

const ROWS: Array<{ field: keyof Peek; label: UiKey }> = [
  { field: "season", label: "cheatSeason" },
  { field: "world", label: "cheatWorld" },
  { field: "purse", label: "cheatPurse" },
];

function Answers({ title, peek }: { title: UiKey; peek: Peek }) {
  return (
    <>
      <h3>{uiText(title)}</h3>
      <ul className="slots">
        {ROWS.map((row) => {
          const bytes = peek[row.field];
          return (
            <li key={row.field} className={bytes === null ? "bad" : "ok"}>
              <span className="what">{uiText(row.label)}</span>
              <b>{bytes === null ? uiText("cheatNull") : `${bytes} ${uiText("cheatBytes")}`}</b>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** A live proof of the privacy claim: the reads a wallhack would make, answered by the rollup itself. */
export function CheatPanel() {
  const busy = useHud((state) => state.busy);
  const [stranger, setStranger] = useState<Peek | null>(null);
  const [owner, setOwner] = useState<Peek | null>(null);

  async function run(): Promise<void> {
    const live = getLive();
    if (!live) {
      useHud.getState().setNote(uiText("needSession"));
      return;
    }
    useHud.getState().setBusy(true);
    try {
      const [asStranger, asOwner] = await Promise.all([peekAsStranger(live.owner), peekAsOwner(live.rollup, live.owner)]);
      if (getLive() !== live) return;
      setStranger(asStranger);
      setOwner(asOwner);
    } catch (err) {
      if (getLive() === live) useHud.getState().setNote(playerMessage(err));
    } finally {
      if (getLive() === live) useHud.getState().setBusy(false);
    }
  }

  return (
    <aside className="panel">
      <h2>{uiText("cheat")}</h2>
      <p className="dim">{uiText("cheatWhy")}</p>
      <button type="button" disabled={busy} onClick={() => void run()}>
        {uiText("cheatRun")}
      </button>
      {stranger ? <Answers title="cheatStranger" peek={stranger} /> : null}
      {owner ? <Answers title="cheatOwner" peek={owner} /> : null}
    </aside>
  );
}
