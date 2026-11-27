import { uiText } from "../content/text";
import { ItemIcon } from "./ItemIcon";
import { kindName } from "./itemLabel";
import { heldItem, usePack } from "./pack";
import { usePanel } from "./panel";

/** The starter stone axe: what the chain fights with when nothing is equipped. */
const STARTER = { kind: 12, flags: 0, shell: 0, tone: 0, grade: 0, purityBp: 0 };

/** The gear the next fight will use, shown where a hotbar would be. A click opens the pack. */
export function HeldSlot() {
  const held = usePack(heldItem);
  const toggle = usePanel((state) => state.toggle);
  return (
    <button type="button" className="held-slot bare-slot" onClick={() => toggle("pack")}>
      <span className={held ? `cell rarity-${held.rarity}` : "cell"}>
        <ItemIcon item={held ?? STARTER} />
      </span>
      <span>
        <small>{uiText("inHand")}</small>
        {held ? kindName(held.kind) : uiText("starterAxe")}
      </span>
    </button>
  );
}
