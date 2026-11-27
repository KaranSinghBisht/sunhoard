import { useState } from "react";
import { formatHundredths, playerMessage } from "../chain/format";
import { getLive, type LivePlay } from "../chain/live";
import { ownedPda } from "../chain/pdas";
import { crackShell, laterSlot, revealShell } from "../chain/play";
import { openProgram } from "../chain/program";
import { readThawReceipt } from "../chain/thawReceipt";
import { pullAccounts, revealedKeyAt } from "../chain/watch";
import { uiText } from "../content/text";
import { ShellArt } from "./BlockArt";
import { SEALED, usePack, type SlotView } from "./pack";
import { SHELL_NAME } from "./roll/names";
import { percent, rollsForDust } from "./roll/strip";
import { DUST_PPM, PPM, SHELL_CRATER } from "./roll/thawOdds";
import { settleThaw, shortHex, type ThawResult } from "./roll/thawResult";
import { ThawReveal, type ThawPhase } from "./roll/ThawReveal";
import { thawFee, useShells, type ShellView } from "./shells";
import { useHud } from "./store";

/** A shell that was cracked but not yet revealed: only the reveal step is left. */
const CRACKING = 2;

/** One thaw under way or just over. `shell` is the shell as it stood before the fee was paid. */
interface Run {
  id: number;
  shell: ShellView;
  phase: ThawPhase;
  result: ThawResult | null;
}

function openBlocks(): SlotView[] {
  return usePack.getState().slots.filter((item) => item.kind === 0 && (item.flags & SEALED) === 0);
}

function blockKey(item: SlotView): string {
  return `${item.slot}:${item.id}`;
}

/** The shell's chances in a line, from the program's table, for before the fee is paid. */
function oddsLine(size: number): string {
  if (!rollsForDust(size)) return uiText(size === SHELL_CRATER ? "rollTwoBlocks" : "rollOneBlock");
  const dust = DUST_PPM[size] ?? 0;
  return `${uiText("rollSegDust")} ${percent(dust)} · ${uiText("rollSegBlock")} ${percent(PPM - dust)}`;
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
        <ShellArt shell={shell.size} size={32} px={16} />
        <span className="roll-row">
          <span>{uiText(SHELL_NAME[shell.size] ?? "shellSmall")}</span>
          <span className="dim">{oddsLine(shell.size)}</span>
          <span className="dim">
            {uiText("rollSeal")} {shortHex(shell.commitment)}
          </span>
        </span>
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

/** Reads back what the reveal wrote: its receipt, the key in the block's slot and the pack's new blocks. */
/** What the pack and the purse held just before the reveal was sent. */
interface Before {
  blocks: Set<string>;
  purse: bigint | null;
}

async function readResult(live: LivePlay, shell: ShellView, signature: string, before: Before): Promise<ThawResult> {
  const program = openProgram(live.rollup);
  await pullAccounts(live.rollup, program, live.owner);
  const purse = useHud.getState().glints;
  const receipt = await readThawReceipt(live.rollup, program, signature);
  const info = await live.rollup.getAccountInfo(ownedPda("inventory", live.owner));
  return settleThaw({
    shell: shell.size,
    seal: shell.commitment,
    receipt,
    slotKey: info ? revealedKeyAt(program, info.data, shell.slot) : null,
    fresh: openBlocks().filter((item) => !before.blocks.has(blockKey(item))),
    shellGone: !usePack.getState().slots.some((item) => item.slot === shell.slot && (item.flags & SEALED) !== 0),
    // The reveal is the only thing that pays the purse between the two readings: the HUD is busy throughout.
    purseGain: before.purse !== null && purse !== null ? purse - before.purse : null,
  });
}

/** Crack, wait a slot, reveal, read back: each stage is told to `at` as it starts. */
async function thawOnChain(live: LivePlay, shell: ShellView, at: (phase: ThawPhase) => void): Promise<ThawResult> {
  const { rollup, session, owner, link } = live;
  const blocks = new Set(openBlocks().map(blockKey));
  if ((shell.flags & CRACKING) === 0) {
    at("crack");
    await crackShell(rollup, session.signer, owner, session.token, link, shell.slot);
    at("slot");
    await laterSlot(rollup);
  }
  at("reveal");
  // Read the purse after the fee and before the reveal, so the reveal's own payment can be told apart.
  await pullAccounts(rollup, openProgram(rollup), owner);
  const purse = useHud.getState().glints;
  const signature = await revealShell(rollup, session.signer, owner, session.token, link, shell.slot);
  at("read");
  return readResult(live, shell, signature, { blocks, purse });
}

let runs = 0;

export function ThawPanel() {
  const shells = useShells((state) => state.shells);
  const [run, setRun] = useState<Run | null>(null);

  async function thaw(picked: ShellView): Promise<void> {
    const live = getLive();
    if (!live) {
      useHud.getState().setNote(uiText("needSession"));
      return;
    }
    // The seal is copied now, before anything is paid: it is what the reveal is checked against.
    const shell = { ...picked, commitment: Uint8Array.from(picked.commitment) };
    runs += 1;
    const started: Run = { id: runs, shell, phase: "crack", result: null };
    setRun(started);
    useHud.getState().setBusy(true);
    try {
      const result = await thawOnChain(live, shell, (phase) => setRun({ ...started, phase }));
      setRun({ ...started, phase: "done", result });
    } catch (err) {
      setRun(null);
      useHud.getState().setNote(playerMessage(err));
    } finally {
      useHud.getState().setBusy(false);
    }
  }

  return (
    <aside className="panel roll-thawery">
      <h2>{uiText("thaw")}</h2>
      {run ? (
        <ThawReveal key={run.id} shell={run.shell} phase={run.phase} result={run.result} onBack={() => setRun(null)} />
      ) : (
        <>
          {shells.length === 0 ? <p>{uiText("noShell")}</p> : null}
          <ul className="slots">
            {shells.map((shell) => (
              <ShellRow key={shell.slot} shell={shell} onThaw={(picked) => void thaw(picked)} />
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
