import { useRef, useState } from "react";
import { formatHundredths, playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { ownedPda } from "../chain/pdas";
import { crackShell, laterSlot, revealShell } from "../chain/play";
import { openProgram } from "../chain/program";
import { pullAccounts, revealedKeyAt } from "../chain/watch";
import { uiText } from "../content/text";
import { sealMatches } from "../shared/seal";
import { thawFee, useShells } from "./shells";
import { useHud } from "./store";

/** A shell that was cracked but not yet revealed: only the reveal step is left. */
const CRACKING = 2;

export function ThawPanel() {
  const shells = useShells((state) => state.shells);
  const busy = useHud((state) => state.busy);
  const glints = useHud((state) => state.glints);
  const saved = useRef(new Map<number, Uint8Array>());
  const [verdict, setVerdict] = useState("");
  /** Set after a successful thaw: the page proves sha256(key) == the pre-thaw commitment. */
  const [sealOk, setSealOk] = useState(false);

  async function thaw(slot: number, commitment: Uint8Array, cracking: boolean): Promise<void> {
    const live = getLive();
    if (!live) {
      useHud.getState().setNote(uiText("needSession"));
      return;
    }
    // Always remember the commitment, including a resume of a stuck crack.
    saved.current.set(slot, commitment);
    setSealOk(false);
    useHud.getState().setBusy(true);
    try {
      if (cracking) {
        await revealShell(live.rollup, live.session.signer, live.owner, live.session.token, live.link, slot);
      } else {
        await crackShell(live.rollup, live.session.signer, live.owner, live.session.token, live.link, slot);
        await laterSlot(live.rollup);
        await revealShell(live.rollup, live.session.signer, live.owner, live.session.token, live.link, slot);
      }
      const program = openProgram(live.rollup);
      await pullAccounts(live.rollup, program, live.owner);
      const info = await live.rollup.getAccountInfo(ownedPda("inventory", live.owner));
      const key = info ? revealedKeyAt(program, info.data, slot) : null;
      const before = saved.current.get(slot);
      const matched = Boolean(key && before && sealMatches(key, before));
      setSealOk(matched);
      setVerdict(uiText("thawed"));
    } catch (err) {
      useHud.getState().setNote(playerMessage(err));
    } finally {
      useHud.getState().setBusy(false);
    }
  }

  const shell = shells[0];
  const cracking = Boolean(shell && (shell.flags & CRACKING) !== 0);
  // The fee is charged by `crack`; a shell already cracking has paid it.
  const fee = shell && !cracking ? thawFee(shell.size) : 0n;
  const short = glints !== null && glints < fee;

  return (
    <aside className="panel">
      <h2>{uiText("thaw")}</h2>
      {shell ? (
        <button
          type="button"
          disabled={busy || short}
          onClick={() => void thaw(shell.slot, shell.commitment, cracking)}
        >
          {cracking ? uiText("reveal") : uiText("thaw")} {shell.slot}
        </button>
      ) : (
        <p>{uiText("noShell")}</p>
      )}
      {fee > 0n ? (
        <p>
          {uiText(short ? "thawShort" : "thawFee")} {formatHundredths(fee)} {uiText("glints")}
        </p>
      ) : null}
      {sealOk ? <p>{uiText("sealOk")}</p> : null}
      {verdict && !sealOk ? <p>{verdict}</p> : null}
    </aside>
  );
}
