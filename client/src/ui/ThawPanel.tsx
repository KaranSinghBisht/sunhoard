import { useRef, useState } from "react";
import { playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { thawShell } from "../chain/play";
import { uiText } from "../content/text";
import { sealMatches } from "../shared/seal";
import { useShells } from "./shells";
import { useHud } from "./store";

export function ThawPanel() {
  const shells = useShells((state) => state.shells);
  const busy = useHud((state) => state.busy);
  const saved = useRef(new Map<number, Uint8Array>());
  const [verdict, setVerdict] = useState("");

  async function thaw(slot: number, commitment: Uint8Array): Promise<void> {
    const live = getLive();
    if (!live) {
      useHud.getState().setNote(uiText("needSession"));
      return;
    }
    saved.current.set(slot, commitment);
    useHud.getState().setBusy(true);
    try {
      await thawShell(live.rollup, live.session.signer, live.owner, live.session.token, live.link, slot);
      setVerdict(uiText("thawed"));
    } catch (err) {
      useHud.getState().setNote(playerMessage(err));
    } finally {
      useHud.getState().setBusy(false);
    }
  }

  const shell = shells[0];
  const remembered = shell ? saved.current.get(shell.slot) : undefined;
  const matched = shell && remembered ? sealMatches(shell.key, remembered) : false;

  return (
    <aside className="panel">
      <h2>{uiText("thaw")}</h2>
      {shell ? (
        <button type="button" disabled={busy} onClick={() => void thaw(shell.slot, shell.commitment)}>
          {uiText("thaw")} {shell.slot}
        </button>
      ) : (
        <p>{uiText("noShell")}</p>
      )}
      {matched ? <p>{uiText("sealOk")}</p> : null}
      {verdict && !matched ? <p>{verdict}</p> : null}
    </aside>
  );
}
