import { formatHundredths } from "../../chain/format";
import { uiText } from "../../content/text";
import { HEAT_CAP } from "../../gen/economy";
import { kindName } from "../itemLabel";
import type { SlotView } from "../pack";
import { RARITY_NAME } from "./names";
import { StrikeWheel, type WheelState } from "./StrikeWheel";
import { percent } from "./strip";
import { HEAT_PER_FAIL, scrapBack } from "./wheel";

/** The terms of one strike, as the program will apply them. */
export interface StrikeTerms {
  item: SlotView;
  /** The chance of a hit in basis points, heat included: `plan_strike`'s `odds_bp`. */
  oddsBp: number;
  fee: bigint;
  /** The value on the anvil in Glint hundredths: the piece, its fodder and the Glints fed. */
  inputs: bigint;
  /** The heat already on this rarity step, in percentage points. */
  heat: number;
}

/** A strike under way or over, with its terms frozen as they stood when the hammer fell. */
export interface Struck extends StrikeTerms {
  /** send: the strike is on its way. roll: it landed, the roll is out. land: the wheel is stopping. */
  state: "send" | "roll" | "land" | "done" | "late";
  hit: boolean;
  rest: number;
  /** The heat the chain holds after the roll, in percentage points. */
  heatAfter: number;
}

const WHEEL: Record<Struck["state"], WheelState> = { send: "spin", roll: "spin", land: "land", done: "done", late: "plan" };

function rarityName(rarity: number): string {
  return uiText(RARITY_NAME[rarity] ?? "rarityCommon");
}

/** What a hit gives and what a miss costs, with the program's own numbers. */
function Terms({ terms }: { terms: StrikeTerms }) {
  const gain = Math.min(terms.heat + HEAT_PER_FAIL, HEAT_CAP) - terms.heat;
  return (
    <dl className="roll-terms">
      <dt className="hit">
        {uiText("rollHitLine")} {percent(terms.oddsBp * 100)}
      </dt>
      <dd>
        {uiText("rollHitGives")} {rarityName(terms.item.rarity + 1)}. {uiText("rollHitBurns")}
        {terms.heat > 0 ? ` (${uiText("rollHeat")} +${Math.min(terms.heat, HEAT_CAP)}%)` : ""}
      </dd>
      <dt className="miss">
        {uiText("rollMissLine")} {percent((10_000 - terms.oddsBp) * 100)}
      </dt>
      <dd>
        {uiText("rollMissCosts")} {uiText("rollScrap")} {formatHundredths(scrapBack(terms.inputs))}.
        {gain > 0 ? ` ${uiText("rollHeatNext")} +${gain}%.` : ""}
      </dd>
      <dd className="dim">
        {uiText("fee")} {formatHundredths(terms.fee)} · {uiText("rollFodderGone")}
      </dd>
    </dl>
  );
}

/** The line under the wheel: what is happening, then what the chain decided. */
function Verdict({ struck }: { struck: Struck }) {
  if (struck.state === "send") return <p className="roll-status">{uiText("rollSending")}</p>;
  if (struck.state === "roll" || struck.state === "land") return <p className="roll-status">{uiText("rollWaiting")}</p>;
  if (struck.state === "late") return <p className="roll-status late">{uiText("rollLate")}</p>;
  if (struck.hit) {
    return (
      <p className="roll-status hit">
        {uiText("rollHit")} · {kindName(struck.item.kind)} {uiText("rollIsNow")} {rarityName(struck.item.rarity + 1)}
      </p>
    );
  }
  return (
    <p className="roll-status miss">
      {uiText("rollMiss")} · {uiText("rollCracked")} {uiText("rollHeatNow")} +{struck.heatAfter}%
    </p>
  );
}

interface AnvilRollProps {
  /** The strike the form describes now; null when there is none to plan. */
  plan: StrikeTerms | null;
  /** A strike already sent. While it is set the wheel belongs to it, not to the form. */
  struck: Struck | null;
  /** Why there is no plan, said plainly. */
  why: string;
}

/** The wheel, the terms beside it and the verdict under it. */
export function AnvilRoll({ plan, struck, why }: AnvilRollProps) {
  const terms = struck ?? plan;
  return (
    <div className="roll-anvil">
      <div className="roll-anvil-top">
        <StrikeWheel
          oddsBp={terms ? terms.oddsBp : null}
          state={struck ? WHEEL[struck.state] : "plan"}
          hit={struck !== null && struck.hit}
          rest={struck ? struck.rest : 0.5}
        />
        {terms ? <Terms terms={terms} /> : <p className="dim">{why}</p>}
      </div>
      <div role="status">{struck ? <Verdict struck={struck} /> : null}</div>
    </div>
  );
}
