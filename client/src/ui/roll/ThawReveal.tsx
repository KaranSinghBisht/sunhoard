import { useEffect } from "react";
import { formatHundredths } from "../../chain/format";
import { playSfx } from "../../art/sound";
import { uiText, type UiKey } from "../../content/text";
import { BlockArt, ShellArt } from "../BlockArt";
import type { SlotView } from "../pack";
import type { ShellView } from "../shells";
import { GRADE_NAME, SHELL_NAME, TONE_NAME } from "./names";
import { OddsStrip } from "./OddsStrip";
import { SealStamp } from "./SealStamp";
import { chainStrips, stripsFor, waitingStrip, type Strip } from "./strip";
import type { ThawResult } from "./thawResult";
import { useSteps } from "./useSteps";

/** Where a thaw is: its three transactions' stages, the read-back, then the result. */
export type ThawPhase = "crack" | "slot" | "reveal" | "read" | "done";

/** How long one strip's marker runs before it stops, and how long the block takes to appear. */
const STRIP_MS = 2100;
const POP_MS = 900;
/** With more strips than this, a stopped strip folds its legend away. */
const COMPACT_FROM = 2;

const SAY: Record<ThawPhase, UiKey> = {
  crack: "rollSayCrack",
  slot: "rollSaySlot",
  reveal: "rollSayReveal",
  read: "rollSayRead",
  done: "rollSayRolls",
};
const STAGES: Array<{ phase: ThawPhase; name: UiKey }> = [
  { phase: "crack", name: "rollStepCrack" },
  { phase: "slot", name: "rollStepSlot" },
  { phase: "reveal", name: "rollStepReveal" },
];
const ORDER: ThawPhase[] = ["crack", "slot", "reveal", "read", "done"];

/** The three chain steps as lamps: lit when passed, blinking while under way. */
function Stages({ phase }: { phase: ThawPhase }) {
  const now = ORDER.indexOf(phase);
  return (
    <ol className="roll-stages">
      {STAGES.map((stage, index) => (
        <li key={stage.phase} className={index < now ? "past" : index === now ? "now" : undefined}>
          {uiText(stage.name)}
        </li>
      ))}
    </ol>
  );
}

function BlockCard({ block, small }: { block: SlotView; small: boolean }) {
  const spec = { tone: block.tone, grade: block.grade, purityBp: block.purityBp, pattern: block.pattern };
  return (
    <div className={`roll-card grade-${block.grade}`}>
      <BlockArt spec={spec} size={small ? 64 : 96} px={64} className="roll-pop" />
      <div>
        <h3>
          {uiText(TONE_NAME[block.tone] ?? "toneDawn")} {uiText(GRADE_NAME[block.grade] ?? "gradeDim")} {uiText("blockLabel")}
        </h3>
        <p className="dim">
          {uiText("purity")} {(block.purityBp / 100).toFixed(2)}%
        </p>
      </div>
    </div>
  );
}

/** What came out, once every strip has stopped. Each line is what the chain wrote, or says it could not be read. */
function Prize({ result }: { result: ThawResult }) {
  if (result.kind === "blocks") {
    return (
      <>
        {result.rolled ? null : <p className="dim">{uiText("rollUnread")}</p>}
        <div className={result.blocks.length > 1 ? "roll-cards two" : "roll-cards"}>
          {result.blocks.map((block) => (
            <BlockCard key={`${block.slot}:${block.id}`} block={block} small={result.blocks.length > 1} />
          ))}
        </div>
      </>
    );
  }
  if (result.kind === "dust") {
    return (
      <div className="roll-card is-dust">
        <span className="roll-dust roll-pop" aria-hidden="true" />
        <div>
          <h3>{uiText("rollSegDust")}</h3>
          <p className="dim">{result.dust === null ? uiText("thawDust") : `${uiText("rollDustPaid")} +${formatHundredths(result.dust)}`}</p>
        </div>
      </div>
    );
  }
  return <p>{uiText(result.kind === "refund" ? "rollRefund" : "rollUnknown")}</p>;
}

/** The shell while the chain works: it shakes harder and its crack grows with each stage. */
function Shaking({ shell, phase }: { shell: ShellView; phase: ThawPhase }) {
  return (
    <div className="roll-card">
      <span className={`roll-shell at-${phase}`}>
        <ShellArt shell={shell.size} size={96} px={64} />
        <svg className="roll-crack" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 1v4h-3v3h4v4h-3v3h4v3h-2v5" pathLength={100} />
        </svg>
      </span>
      <div>
        <h3>{uiText(SHELL_NAME[shell.size] ?? "shellSmall")}</h3>
        <Stages phase={phase} />
        <p className="dim" role="status">
          {uiText(SAY[phase])}
        </p>
      </div>
    </div>
  );
}

/** The rolls when the key gave them; otherwise the chain's outcome alone; nothing when even that is unknown. */
function stripsOf(result: ThawResult | null): Strip[] {
  if (!result) return [];
  if (result.rolled) return stripsFor(result.rolled);
  if (result.kind !== "blocks" && result.kind !== "dust") return [];
  return chainStrips(result.shell, result.blocks.map((block) => block.grade));
}

interface RevealProps {
  shell: ShellView;
  phase: ThawPhase;
  /** Null until the chain has answered. */
  result: ThawResult | null;
  onBack: () => void;
}

/**
 * One thaw, staged: the shell cracks while the transactions run, each roll's marker stops
 * on its strip, the block appears, and the seal is stamped. Nothing is shown as a result
 * until `result` holds what the chain wrote.
 */
export function ThawReveal({ shell, phase, result, onBack }: RevealProps) {
  const strips = stripsOf(result);
  const step = useSteps(result ? shell.slot : null, [...strips.map(() => STRIP_MS), POP_MS]);
  const opened = result !== null && step >= strips.length;
  const stamped = result !== null && step > strips.length;
  const prize = result?.kind;

  useEffect(() => {
    if (opened && prize === "blocks") playSfx("thaw");
    if (opened && prize === "dust") playSfx("coin");
  }, [opened, prize]);

  return (
    <div className="roll-thaw">
      {opened && result ? <Prize result={result} /> : <Shaking shell={shell} phase={result ? "done" : phase} />}
      {result ? null : <OddsStrip strip={waitingStrip(shell.size)} state="idle" />}
      {strips.map((strip, index) =>
        index <= step ? (
          <OddsStrip key={`${strip.kind}:${index}`} strip={strip} state={index < step ? "landed" : "run"} compact={strips.length > COMPACT_FROM} />
        ) : null,
      )}
      <SealStamp
        seal={shell.commitment}
        keyHash={stamped && result ? result.keyHash : null}
        ok={stamped && result !== null && result.sealOk}
        waiting={!stamped}
        dust={prize === "dust"}
      />
      {stamped ? (
        <button type="button" className="roll-back" onClick={onBack}>
          {uiText("rollBack")}
        </button>
      ) : null}
    </div>
  );
}
