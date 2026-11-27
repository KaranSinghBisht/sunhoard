import { uiText } from "../../content/text";
import { itemLabel } from "../itemLabel";
import type { SlotView } from "../pack";

interface PickProps {
  /** The pieces that may go on the anvil. */
  gear: SlotView[];
  value: number;
  locked: boolean;
  onPick: (slot: number) => void;
}

/** The piece to strike. */
export function GearPick({ gear, value, locked, onPick }: PickProps) {
  return (
    <div className="row">
      <select value={value} disabled={locked} onChange={(event) => onPick(Number(event.target.value))}>
        <option value={-1}>{uiText("pickGear")}</option>
        {gear.map((slot) => (
          <option key={slot.slot} value={slot.slot}>
            {itemLabel(slot)}
          </option>
        ))}
      </select>
    </div>
  );
}

interface FodderProps {
  slots: SlotView[];
  picked: number[];
  locked: boolean;
  onToggle: (slot: number) => void;
}

/** Everything in the pack that may be burned for better odds. */
export function FodderList({ slots, picked, locked, onToggle }: FodderProps) {
  return (
    <ul className="fodder">
      {slots.map((slot) => (
        <li key={slot.slot}>
          <label>
            <input type="checkbox" disabled={locked} checked={picked.includes(slot.slot)} onChange={() => onToggle(slot.slot)} />
            {itemLabel(slot)}
          </label>
        </li>
      ))}
    </ul>
  );
}

interface FeedProps {
  glints: string;
  locked: boolean;
  /** There is a strike the program would accept and the purse can pay for. */
  ready: boolean;
  onGlints: (typed: string) => void;
  onStrike: () => void;
}

/** Glints for the forge, and the hammer. */
export function FeedRow({ glints, locked, ready, onGlints, onStrike }: FeedProps) {
  return (
    <div className="row">
      <label className="roll-feed">
        {uiText("glintsFodder")}
        <input value={glints} disabled={locked} inputMode="decimal" onChange={(event) => onGlints(event.target.value)} />
      </label>
      <button type="button" disabled={locked || !ready} onClick={onStrike}>
        {uiText("strike")}
      </button>
    </div>
  );
}
