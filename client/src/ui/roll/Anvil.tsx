import { useEffect, useState } from "react";
import { playSfx } from "../../art/sound";
import { formatHundredths, parseGlints, playerMessage } from "../../chain/format";
import { strikeAndWait } from "../../chain/forge";
import { getLive } from "../../chain/live";
import { uiText } from "../../content/text";
import { REFUSE_BELOW_BP } from "../../gen/economy";
import { charterValue, planStrike } from "../../shared/economy";
import { useAnvil } from "../anvil";
import { BOUND, CRACKING, FORGING, LISTED, SEALED } from "../market";
import { isGear, usePack, type SlotView } from "../pack";
import { useHud } from "../store";
import { FeedRow, FodderList, GearPick } from "./AnvilForm";
import { AnvilRoll, type StrikeTerms, type Struck } from "./AnvilRoll";
import { percent } from "./strip";
import { reducedMotion } from "./useSteps";

/** The anvil takes at most eight fodder slots, and none that is bound, sealed, listed or mid-roll. */
const MAX_FODDER = 8;
const NOT_FODDER = BOUND | SEALED | LISTED | CRACKING | FORGING;
/** How long the wheel takes to stop once the result is known; `roll-stop` in roll.css runs as long. */
const LAND_MS = 2800;

/** A stack burns whole, so it is worth its unit price times its count, as on chain. */
function fodderValue(slots: SlotView[], fodder: number[]): bigint {
  return fodder.reduce((sum, slot) => {
    const candidate = slots.find((entry) => entry.slot === slot);
    if (!candidate) return sum;
    const units = candidate.id === "0" ? BigInt(candidate.quantity) : 1n;
    return sum + charterValue(candidate) * units;
  }, 0n);
}

/** The strike as the program will plan it: null when it would be refused. */
function termsFor(item: SlotView | undefined, extra: bigint, heat: number[]): StrikeTerms | null {
  if (!item || !isGear(item.kind)) return null;
  const material = item.kind >= 17 ? 2 : item.kind >= 14 ? 1 : 0;
  const inputs = charterValue(item) + extra;
  const step = heat[item.rarity + 1] ?? 0;
  const plan = planStrike(material, item.rarity, inputs, step);
  return plan ? { item, oddsBp: plan.odds, fee: plan.fee, inputs, heat: step } : null;
}

function whyNoPlan(item: SlotView | undefined, stake: bigint | null): string {
  if (!item) return uiText("rollPick");
  if (stake === null) return uiText("rollBadGlints");
  return `${uiText("rollTooLittle")} ${percent(REFUSE_BELOW_BP * 100)} ${uiText("rollBeforeHeat")}`;
}

/** Stops the wheel on the chain's result after its run, then sounds it. */
function useLanding(struck: Struck | null, setStruck: (next: Struck) => void): void {
  useEffect(() => {
    if (!struck || struck.state !== "land") return undefined;
    const timer = window.setTimeout(() => {
      setStruck({ ...struck, state: "done" });
      playSfx(struck.hit ? "powerup" : "anvil");
    }, reducedMotion() ? 0 : LAND_MS);
    return () => window.clearTimeout(timer);
  }, [struck, setStruck]);
}

/**
 * Sends one strike and follows it to the chain's result, telling `show` each stage. The
 * wheel is only told to stop once `strikeAndWait` has read hit or miss from the pack.
 */
function sendStrike(sent: Struck, fodder: number[], stake: bigint, show: (next: Struck | null) => void, clear: () => void): void {
  const live = getLive();
  if (!live) return useHud.getState().setNote(uiText("needSession"));
  show(sent);
  useHud.getState().setBusy(true);
  playSfx("anvil");
  strikeAndWait(live, { item: sent.item, fodder, glints: stake.toString() }, () => show({ ...sent, state: "roll" }))
    .then((end) => {
      const heatAfter = useAnvil.getState().heat[sent.item.rarity + 1] ?? 0;
      show({ ...sent, state: end === "pending" ? "late" : "land", hit: end === "hit", heatAfter });
      clear();
    })
    .catch((err: unknown) => {
      show(null);
      useHud.getState().setNote(playerMessage(err));
    })
    .finally(() => useHud.getState().setBusy(false));
}

/** The strike the form describes: its terms, and whether the purse can pay for it. */
function planOf(slots: SlotView[], strikeSlot: number, fodder: number[], glints: string, heat: number[], purse: bigint | null) {
  const stake = parseGlints(glints);
  const item = slots.find((slot) => slot.slot === strikeSlot);
  const plan = stake === null ? null : termsFor(item, fodderValue(slots, fodder) + stake, heat);
  const cost = plan !== null && stake !== null ? plan.fee + stake : null;
  return { stake, item, plan, cost, short: cost !== null && purse !== null && purse < cost };
}

/** Ticks or unticks one fodder slot, up to the anvil's limit. */
function toggled(current: number[], slot: number): number[] {
  if (current.includes(slot)) return current.filter((entry) => entry !== slot);
  return current.length >= MAX_FODDER ? current : [...current, slot];
}

/**
 * The anvil: pick a piece, feed it, and watch the wheel. The wheel always shows the real
 * odds of the strike as it stands; after Strike it spins until the VRF callback has
 * landed and stops inside the slice the chain chose.
 */
export function Anvil() {
  const slots = usePack((state) => state.slots);
  const heat = useAnvil((state) => state.heat);
  const busy = useHud((state) => state.busy);
  const purse = useHud((state) => state.glints);
  const [strikeSlot, setStrikeSlot] = useState(-1);
  const [fodder, setFodder] = useState<number[]>([]);
  const [glints, setGlints] = useState("0");
  const [struck, setStruck] = useState<Struck | null>(null);
  useLanding(struck, setStruck);
  const { stake, item, plan, cost, short } = planOf(slots, strikeSlot, fodder, glints, heat, purse);
  const locked = busy || (struck !== null && struck.state !== "done" && struck.state !== "late");
  const free = slots.filter((slot) => (slot.flags & NOT_FODDER) === 0);

  // Any change to the form clears the last strike's result: the wheel shows the new plan.
  function edit(change: () => void): void {
    setStruck(null);
    change();
  }

  function strike(): void {
    if (!plan || stake === null) return;
    sendStrike({ ...plan, state: "send", hit: false, rest: Math.random(), heatAfter: plan.heat }, fodder, stake, setStruck, () => {
      setFodder([]);
      setGlints("0");
      setStrikeSlot(-1);
    });
  }

  return (
    <div className="roll-forge">
      <GearPick gear={free.filter((slot) => isGear(slot.kind))} value={strikeSlot} locked={locked} onPick={(slot) => edit(() => setStrikeSlot(slot))} />
      <AnvilRoll plan={plan} struck={struck} why={whyNoPlan(item, stake)} />
      <FodderList
        slots={free.filter((slot) => slot.slot !== strikeSlot)}
        picked={fodder}
        locked={locked}
        onToggle={(slot) => edit(() => setFodder((current) => toggled(current, slot)))}
      />
      {short && cost !== null ? (
        <p className="roll-warn">
          {uiText("rollPurseShort")} {formatHundredths(cost)}
        </p>
      ) : null}
      <FeedRow glints={glints} locked={locked} ready={plan !== null && !short} onGlints={(typed) => edit(() => setGlints(typed))} onStrike={strike} />
    </div>
  );
}
