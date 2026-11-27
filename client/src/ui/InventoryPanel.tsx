import { useState } from "react";
import { getLive } from "../chain/live";
import { playAction } from "../chain/play";
import { formatHundredths, playerMessage } from "../chain/format";
import { uiText, type UiKey } from "../content/text";
import { shopPrice } from "../shared/economy";
import { BarnPanel } from "./BarnPanel";
import { ItemIcon } from "./ItemIcon";
import { kindName } from "./itemLabel";
import { usePack } from "./pack";
import { PackGrid } from "./PackGrid";
import { useHud } from "./store";

interface Recipe {
  id: number;
  name: UiKey;
  inputs: string;
  /** The kind the recipe makes, for its icon. */
  makes: number;
  gear: boolean;
}

const RECIPES: Recipe[] = [
  { id: 1, name: "recipePlanks", inputs: "1 wood", makes: 7, gear: false },
  { id: 2, name: "recipeBar", inputs: "3 ore + 1 coal", makes: 8, gear: false },
  { id: 3, name: "recipeMeal", inputs: "3 food + 1 coal", makes: 9, gear: false },
  { id: 4, name: "recipeTorch", inputs: "1 plank + 1 coal", makes: 10, gear: false },
  { id: 5, name: "recipeStoneAxe", inputs: "2 planks + 4 stone", makes: 12, gear: true },
  { id: 6, name: "recipeStonePickaxe", inputs: "2 planks + 4 stone", makes: 13, gear: true },
  { id: 7, name: "recipeIronAxe", inputs: "4 bars + 2 planks", makes: 14, gear: true },
  { id: 8, name: "recipeIronPickaxe", inputs: "4 bars + 2 planks", makes: 15, gear: true },
  { id: 9, name: "recipeIronSword", inputs: "4 bars + 2 planks", makes: 16, gear: true },
  { id: 10, name: "recipeGildedAxe", inputs: "5 bars + 4 wickwax", makes: 17, gear: true },
  { id: 11, name: "recipeGildedPickaxe", inputs: "5 bars + 4 wickwax", makes: 18, gear: true },
  { id: 12, name: "recipeGildedBlade", inputs: "5 bars + 4 wickwax", makes: 19, gear: true },
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

/** What the top bar says once an action has landed, so a click never passes in silence. */
function doneNote(kind: "craft" | "sell" | "buy" | "eat" | "equip", value: number): string {
  if (kind === "sell") return uiText("soldNote");
  if (kind === "buy") return uiText("boughtNote");
  if (kind === "craft") return uiText("craftedNote");
  if (kind !== "equip") return "";
  const item = usePack.getState().slots.find((slot) => slot.slot === value);
  return item ? `${kindName(item.kind)} ${uiText("equippedNote")}` : "";
}

type Act = (kind: "craft" | "sell" | "buy" | "eat" | "equip", value: number) => void;

function plain(kind: number) {
  return { kind, flags: 0, shell: 0, tone: 0, grade: 0, purityBp: 0 };
}

function Workbench({ act }: { act: Act }) {
  const busy = useHud((state) => state.busy);
  return (
    <ul className="recipes">
      {RECIPES.map((recipe) => (
        <li key={recipe.id}>
          <button type="button" disabled={busy} onClick={() => act("craft", recipe.id)}>
            <ItemIcon item={plain(recipe.makes)} size={24} />
            {uiText(recipe.name)}
          </button>
          <span className="dim">
            {recipe.inputs}
            {recipe.gear ? " · roll" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Pell sells for Glints; a good the purse cannot cover is greyed out instead of refused on chain. */
function Counter({ act }: { act: Act }) {
  const busy = useHud((state) => state.busy);
  const glints = useHud((state) => state.glints) ?? 0n;
  const poor = PELL_GOODS.every((good) => shopPrice(good.kind) > glints);
  return (
    <>
      <p className="dim">
        {uiText("pellBuy")} · {uiText("pellPurse")} <b>{formatHundredths(glints)}</b>
      </p>
      {poor ? <p className="warn">{uiText("pellShort")}</p> : null}
      <ul className="recipes">
        {PELL_GOODS.map((good) => (
          <li key={good.kind}>
            <button type="button" disabled={busy || shopPrice(good.kind) > glints} onClick={() => act("buy", good.kind)}>
              <ItemIcon item={plain(good.kind)} size={24} />
              {uiText(good.name)}
            </button>
            <span className="dim">{formatHundredths(shopPrice(good.kind))}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The tabs beside the pack. The barn lives here: it is a place to put what the pack holds. */
const SIDES = ["workbench", "pell", "barn"] as const;
type Side = (typeof SIDES)[number];

export function InventoryPanel() {
  const [side, setSide] = useState<Side>("workbench");

  function act(kind: "craft" | "sell" | "buy" | "eat" | "equip", value: number): void {
    const live = getLive();
    if (!live) {
      useHud.getState().setNote(uiText("needSession"));
      return;
    }
    useHud.getState().setBusy(true);
    const done = doneNote(kind, value);
    playAction(live.rollup, live.session.signer, live.owner, live.session.token, live.link, kind, value)
      .then(() => { if (getLive() === live && done) useHud.getState().setNote(done); })
      .catch((err) => { if (getLive() === live) useHud.getState().setNote(playerMessage(err)); })
      .finally(() => { if (getLive() === live) useHud.getState().setBusy(false); });
  }

  return (
    <aside className="panel pack">
      <div className="col">
        <h2>{uiText("inventory")}</h2>
        <PackGrid act={act} />
      </div>
      <div className="col">
        <div className="tabs" role="tablist">
          {SIDES.map((id) => (
            <button type="button" key={id} role="tab" className="quiet" aria-selected={side === id} onClick={() => setSide(id)}>
              {uiText(id)}
            </button>
          ))}
        </div>
        {side === "workbench" ? <Workbench act={act} /> : null}
        {side === "pell" ? <Counter act={act} /> : null}
        {side === "barn" ? <BarnPanel /> : null}
      </div>
    </aside>
  );
}
