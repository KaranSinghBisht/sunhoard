import { getLive } from "../chain/live";
import { playAction } from "../chain/play";
import { formatHundredths, playerMessage } from "../chain/format";
import { uiText, type UiKey } from "../content/text";
import { BOUND, KIND_MEAL, SEALED, isGear, usePack } from "./pack";
import { itemLabel } from "./itemLabel";
import { shopPrice } from "../shared/economy";
import { useHud } from "./store";

interface Recipe {
  id: number;
  name: UiKey;
  inputs: string;
  gear: boolean;
}

const RECIPES: Recipe[] = [
  { id: 1, name: "recipePlanks", inputs: "1 wood", gear: false },
  { id: 2, name: "recipeBar", inputs: "3 ore + 1 coal", gear: false },
  { id: 3, name: "recipeMeal", inputs: "3 food + 1 coal", gear: false },
  { id: 4, name: "recipeTorch", inputs: "1 plank + 1 coal", gear: false },
  { id: 5, name: "recipeStoneAxe", inputs: "2 planks + 4 stone", gear: true },
  { id: 6, name: "recipeStonePickaxe", inputs: "2 planks + 4 stone", gear: true },
  { id: 7, name: "recipeIronAxe", inputs: "4 bars + 2 planks", gear: true },
  { id: 8, name: "recipeIronPickaxe", inputs: "4 bars + 2 planks", gear: true },
  { id: 9, name: "recipeIronSword", inputs: "4 bars + 2 planks", gear: true },
  { id: 10, name: "recipeGildedAxe", inputs: "5 bars + 4 wickwax", gear: true },
  { id: 11, name: "recipeGildedPickaxe", inputs: "5 bars + 4 wickwax", gear: true },
  { id: 12, name: "recipeGildedBlade", inputs: "5 bars + 4 wickwax", gear: true },
];

/** Pell's counter: a good kind and its shop price in Glints (hundredths inside). */
const PELL_GOODS: Array<{ kind: number; name: UiKey }> = [
  { kind: 1, name: "kindWood" },
  { kind: 2, name: "kindStone" },
  { kind: 3, name: "kindCoal" },
  { kind: 5, name: "kindFood" },
  { kind: 7, name: "kindPlank" },
  { kind: 4, name: "kindOre" },
  { kind: 8, name: "kindBar" },
  { kind: 9, name: "kindMeal" },
  { kind: 10, name: "kindTorch" },
  { kind: 11, name: "kindSeed" },
  { kind: 14, name: "gearIronAxe" },
  { kind: 15, name: "gearIronPickaxe" },
  { kind: 16, name: "gearIronSword" },
];

export function InventoryPanel() {
  const slots = usePack((state) => state.slots);
  const equipped = usePack((state) => state.equipped);
  const busy = useHud((state) => state.busy);

  function act(kind: "craft" | "sell" | "buy" | "eat" | "equip", value: number): void {
    const live = getLive();
    if (!live) {
      useHud.getState().setNote(uiText("needSession"));
      return;
    }
    useHud.getState().setBusy(true);
    playAction(live.rollup, live.session.signer, live.owner, live.session.token, live.link, kind, value)
      .catch((err) => { if (getLive() === live) useHud.getState().setNote(playerMessage(err)); })
      .finally(() => { if (getLive() === live) useHud.getState().setBusy(false); });
  }

  return (
    <aside className="panel pack">
      <h2>{uiText("inventory")}</h2>
      {slots.length === 0 ? <p>{uiText("emptyPack")}</p> : null}
      <ul className="slots">
        {slots.map((slot) => (
          <li key={slot.slot} className={slot.slot === equipped ? "equipped" : ""}>
            <span className="what">{itemLabel(slot)}</span>
            <span className="acts">
              {slot.kind === KIND_MEAL && (slot.flags & SEALED) === 0 ? (
                <button type="button" disabled={busy} onClick={() => act("eat", slot.slot)}>
                  {uiText("eat")}
                </button>
              ) : null}
              {isGear(slot.kind) ? (
                <button type="button" disabled={busy} onClick={() => act("equip", slot.slot)}>
                  {uiText("equip")}
                </button>
              ) : null}
              {(slot.flags & BOUND) === 0 ? (
                <button type="button" disabled={busy} onClick={() => act("sell", slot.slot)}>
                  {uiText("sell")}
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <h2>{uiText("workbench")}</h2>
      <ul className="recipes">
        {RECIPES.map((recipe) => (
          <li key={recipe.id}>
            <button type="button" disabled={busy} onClick={() => act("craft", recipe.id)}>
              {uiText(recipe.name)}
            </button>
            <span className="dim">
              {recipe.inputs}
              {recipe.gear ? " · roll" : ""}
            </span>
          </li>
        ))}
      </ul>

      <h2>{uiText("pell")}</h2>
      <ul className="recipes">
        {PELL_GOODS.map((good) => (
          <li key={good.kind}>
            <button type="button" disabled={busy} onClick={() => act("buy", good.kind)}>
              {uiText(good.name)}
            </button>
            <span className="dim">{formatHundredths(shopPrice(good.kind))}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
