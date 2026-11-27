import { useRef, useState } from "react";
import { formatHundredths, playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { ownedPda } from "../chain/pdas";
import { crackShell, laterSlot, revealShell } from "../chain/play";
import { openProgram } from "../chain/program";
import { pullAccounts, revealedKeyAt } from "../chain/watch";
import { uiText, type UiKey } from "../content/text";
import { sealMatches } from "../shared/seal";
import { ShellArt } from "./BlockArt";
import { ItemIcon } from "./ItemIcon";
import { itemLabel } from "./itemLabel";
import { SEALED, usePack, type SlotView } from "./pack";
import { thawFee, useShells, type ShellView } from "./shells";
import { useHud } from "./store";

/** A shell that was cracked but not yet revealed: only the reveal step is left. */
const CRACKING = 2;
const SHELL_NAME: UiKey[] = ["shellSmall", "shellMedium", "shellLarge", "shellCrater", "shellBoss"];

interface Outcome {
  /** The page proved sha256(key) == the commitment shown before the fee was paid. */
  sealOk: boolean;
  blocks: SlotView[];
}

function openBlocks(): SlotView[] {
  return usePack.getState().slots.filter((item) => item.kind === 0 && (item.flags & SEALED) === 0);
}

function blockKey(item: SlotView): string {
  return `${item.slot}:${item.id}`;
}

function ShellRow({ shell, onThaw }: { shell: ShellView; onThaw: (shell: ShellView) => void }) {
  const busy = useHud((state) => state.busy);
  const glints = useHud((state) => state.glints);
  const cracking = (shell.flags & CRACKING) !== 0;
  // The fee is charged by `crack`; a shell already cracking has paid it.
  const fee = cracking ? 0n : thawFee(shell.size);
  const short = glints !== null && glints < fee;
  return (
    <li>
      <span className="what">
        <ShellArt shell={shell.size} size={32} px={16} /> {uiText(SHELL_NAME[shell.size] ?? "shellSmall")}
      </span>
      <span className="acts">
        <span className="dim">
          {fee > 0n ? `${uiText(short ? "thawShort" : "thawFee")} ${formatHundredths(fee)}` : uiText("freeThaw")}
        </span>
        <button type="button" disabled={busy || short} onClick={() => onThaw(shell)}>
          {uiText(cracking ? "reveal" : "thaw")}
        </button>
      </span>
    </li>
  );
}

function Result({ outcome }: { outcome: Outcome }) {
  return (
    <div className="thawed">
      {outcome.blocks.length === 0 ? <p>{uiText("thawDust")}</p> : <h3>{uiText("thawGot")}</h3>}
      <ul className="slots">
        {outcome.blocks.map((block) => (
          <li key={blockKey(block)}>
            <span className="what">
              <ItemIcon item={block} size={48} /> {itemLabel(block)}
            </span>
          </li>
        ))}
      </ul>
      <p className={outcome.sealOk ? "proof" : "dim"}>{uiText(outcome.sealOk ? "sealOk" : "thawed")}</p>
    </div>
  );
}

export function ThawPanel() {
  const shells = useShells((state) => state.shells);
  const saved = useRef(new Map<number, Uint8Array>());
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function thaw(shell: ShellView): Promise<void> {
    const live = getLive();
    if (!live) {
      useHud.getState().setNote(uiText("needSession"));
      return;
    }
    const { slot } = shell;
    // Always remember the commitment, including a resume of a stuck crack.
    saved.current.set(slot, shell.commitment);
    const before = new Set(openBlocks().map(blockKey));
    setOutcome(null);
    useHud.getState().setBusy(true);
    try {
      if ((shell.flags & CRACKING) === 0) {
        await crackShell(live.rollup, live.session.signer, live.owner, live.session.token, live.link, slot);
        await laterSlot(live.rollup);
      }
      await revealShell(live.rollup, live.session.signer, live.owner, live.session.token, live.link, slot);
      const program = openProgram(live.rollup);
      await pullAccounts(live.rollup, program, live.owner);
      const info = await live.rollup.getAccountInfo(ownedPda("inventory", live.owner));
      const key = info ? revealedKeyAt(program, info.data, slot) : null;
      const seal = saved.current.get(slot);
      setOutcome({
        sealOk: Boolean(key && seal && sealMatches(key, seal)),
        blocks: openBlocks().filter((item) => !before.has(blockKey(item))),
      });
    } catch (err) {
      useHud.getState().setNote(playerMessage(err));
    } finally {
      useHud.getState().setBusy(false);
    }
  }

  return (
    <aside className="panel">
      <h2>{uiText("thaw")}</h2>
      {shells.length === 0 ? <p>{uiText("noShell")}</p> : null}
      <ul className="slots">
        {shells.map((shell) => (
          <ShellRow key={shell.slot} shell={shell} onThaw={(picked) => void thaw(picked)} />
        ))}
      </ul>
      {outcome ? <Result outcome={outcome} /> : null}
    </aside>
  );
}
