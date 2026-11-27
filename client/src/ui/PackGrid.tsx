import { useState } from "react";
import { uiText } from "../content/text";
import { ItemIcon } from "./ItemIcon";
import { itemLabel } from "./itemLabel";
import { BOUND, KIND_MEAL, LISTED, SEALED, isGear, usePack, type SlotView } from "./pack";
import { usePanel } from "./panel";
import { useHud } from "./store";

/** The pack's size on chain: `INVENTORY_SLOTS` in state/bits.rs. */
const PACK_SLOTS = 48;
const DEMO = 64;

export type PackAct = (kind: "eat" | "equip" | "sell", slot: number) => void;

function cellClass(item: SlotView | undefined, chosen: boolean, equipped: boolean): string {
  const names = ["cell"];
  if (!item) names.push("empty");
  if (chosen) names.push("chosen");
  if (equipped) names.push("equipped");
  if (item && isGear(item.kind)) names.push(`rarity-${item.rarity}`);
  return names.join(" ");
}

function Cell({ item, chosen, equipped, onPick }: { item?: SlotView; chosen: boolean; equipped: boolean; onPick: () => void }) {
  if (!item) return <li className="cell empty" />;
  return (
    <li className={cellClass(item, chosen, equipped)}>
      <button type="button" className="bare" title={itemLabel(item)} aria-pressed={chosen} onClick={onPick}>
        <ItemIcon item={item} />
        {item.quantity > 1 ? <b className="count">{item.quantity}</b> : null}
        {(item.flags & DEMO) !== 0 ? <i className="mark" aria-hidden="true" /> : null}
      </button>
    </li>
  );
}

/** What the chosen slot holds, and what can be done with it. */
function Detail({ item, equipped, act }: { item: SlotView; equipped: boolean; act: PackAct }) {
  const busy = useHud((state) => state.busy);
  const open = usePanel((state) => state.open);
  const sealed = (item.flags & SEALED) !== 0;
  const free = (item.flags & (BOUND | LISTED)) === 0;
  return (
    <div className="detail">
      <ItemIcon item={item} size={48} />
      <p className="what">
        {itemLabel(item)}
        {equipped ? <span className="tag"> · {uiText("equipped")}</span> : null}
      </p>
      <span className="acts">
        {item.kind === KIND_MEAL && !sealed ? (
          <button type="button" disabled={busy} onClick={() => act("eat", item.slot)}>
            {uiText("eat")}
          </button>
        ) : null}
        {isGear(item.kind) ? (
          <button type="button" disabled={busy} onClick={() => act("equip", item.slot)}>
            {uiText("equip")}
          </button>
        ) : null}
        {sealed ? (
          <button type="button" onClick={() => open("thaw")}>
            {uiText("thaw")}
          </button>
        ) : null}
        {free ? (
          <button type="button" disabled={busy} onClick={() => act("sell", item.slot)}>
            {uiText("sellPell")}
          </button>
        ) : null}
        {free ? (
          <button type="button" className="quiet" onClick={() => open("coldfair")}>
            {uiText("listFair")}
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** The pack as a grid of slots, in the order the chain keeps them. */
export function PackGrid({ act }: { act: PackAct }) {
  const slots = usePack((state) => state.slots);
  const equipped = usePack((state) => state.equipped);
  const [picked, setPicked] = useState<number | null>(null);
  const bySlot = new Map(slots.map((item) => [item.slot, item]));
  const chosen = picked === null ? undefined : bySlot.get(picked);
  return (
    <div className="pack-grid">
      <ul className="cells">
        {Array.from({ length: PACK_SLOTS }, (_, index) => (
          <Cell
            key={index}
            item={bySlot.get(index)}
            chosen={picked === index}
            equipped={equipped === index}
            onPick={() => setPicked(picked === index ? null : index)}
          />
        ))}
      </ul>
      {chosen ? (
        <Detail item={chosen} equipped={equipped === chosen.slot} act={act} />
      ) : (
        <p className="detail dim">{uiText(slots.length === 0 ? "emptyPack" : "pickSlot")}</p>
      )}
    </div>
  );
}
