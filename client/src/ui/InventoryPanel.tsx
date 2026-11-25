import { getLive } from "../chain/live";
import { playAction } from "../chain/play";
import { playerMessage } from "../chain/format";
import { uiText, type UiKey } from "../content/text";
import { BOUND, KIND_MEAL, SEALED, isGear, usePack } from "./pack";
import { useHud } from "./store";

const KIND_NAME: Record<number, UiKey> = {
  1: "kindWood",
  2: "kindStone",
  3: "kindCoal",
  4: "kindOre",
  5: "kindFood",
  6: "kindWickwax",
  7: "kindPlank",
  8: "kindBar",
  9: "kindMeal",
  10: "kindTorch",
  11: "kindSeed",
  12: "gearStoneAxe",
  13: "gearStonePickaxe",
  14: "gearIronAxe",
  15: "gearIronPickaxe",
  16: "gearIronSword",
  17: "gearGildedAxe",
  18: "gearGildedPickaxe",
  19: "gearGildedBlade",
};

const TONE_NAME = ["toneDawn", "toneNoon", "toneBlueHour", "toneDusk"] as const;
const GRADE_NAME = ["gradeDim", "gradeGlowing", "gradeBright", "gradeRadiant", "gradeBlazing"] as const;
const RARITY_NAME = ["rarityCommon", "rarityUncommon", "rarityRare", "rarityEpic", "rarityLegendary"] as const;
const SHELL_NAME = ["shellSmall", "shellMedium", "shellLarge", "shellCrater", "shellBoss"] as const;
const TRAIT_NAME: Record<number, UiKey> = {
  1: "traitEfficient",
  2: "traitBountiful",
  3: "traitProspector",
  4: "traitCleave",
  5: "traitSwift",
  6: "traitBrittle",
  7: "traitHeavy",
  8: "traitKeen",
  9: "traitBrutal",
  10: "traitLooter",
  11: "traitDragonbane",
  12: "traitVampiric",
  13: "traitDull",
  14: "traitCursed",
};
const TIERS = ["", "I", "II", "III", "IV", "V"];

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
const PELL_GOODS: Array<{ kind: number; name: UiKey; price: string }> = [
  { kind: 1, name: "kindWood", price: "1" },
  { kind: 2, name: "kindStone", price: "1" },
  { kind: 3, name: "kindCoal", price: "1" },
  { kind: 5, name: "kindFood", price: "1" },
  { kind: 7, name: "kindPlank", price: "0.5" },
  { kind: 4, name: "kindOre", price: "4" },
  { kind: 8, name: "kindBar", price: "10" },
  { kind: 9, name: "kindMeal", price: "6" },
  { kind: 10, name: "kindTorch", price: "1" },
  { kind: 11, name: "kindSeed", price: "1" },
  { kind: 14, name: "gearIronAxe", price: "35" },
  { kind: 15, name: "gearIronPickaxe", price: "40" },
  { kind: 16, name: "gearIronSword", price: "30" },
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
      .catch((err) => useHud.getState().setNote(playerMessage(err)))
      .finally(() => useHud.getState().setBusy(false));
  }

  return (
    <aside className="panel pack">
      <h2>{uiText("inventory")}</h2>
      {slots.length === 0 ? <p>{uiText("emptyPack")}</p> : null}
      <ul className="slots">
        {slots.map((slot) => (
          <li key={slot.slot} className={slot.slot === equipped ? "equipped" : ""}>
            <span className="what">{describe(slot)}</span>
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
            <span className="dim">{good.price}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function describe(slot: {
  kind: number;
  quantity: number;
  rarity: number;
  traits: Array<{ id: number; tier: number }>;
  tone: number;
  grade: number;
  purityBp: number;
  shell: number;
  flags: number;
}): string {
  if (slot.flags & SEALED) {
    const shell = SHELL_NAME[slot.shell ?? 0];
    return uiText(shell ?? "shellSmall");
  }
  if (isGear(slot.kind)) {
    const name = uiText(KIND_NAME[slot.kind] ?? "kindWood");
    const rarity = uiText(RARITY_NAME[slot.rarity] ?? "rarityCommon");
    const traits = slot.traits
      .map((pair) => `${uiText(TRAIT_NAME[pair.id] ?? "traitKeen")} ${TIERS[pair.tier] ?? ""}`)
      .join(", ");
    return traits ? `${name} · ${rarity} · ${traits}` : `${name} · ${rarity}`;
  }
  if (slot.kind === 0) {
    const tone = uiText(TONE_NAME[slot.tone] ?? "toneDawn");
    const grade = uiText(GRADE_NAME[slot.grade] ?? "gradeDim");
    const purity = (slot.purityBp / 10000).toFixed(2);
    return `${tone} ${grade} block · ${uiText("purity")} ${purity}`;
  }
  const name = uiText(KIND_NAME[slot.kind] ?? "kindWood");
  return slot.quantity > 1 ? `${name} ×${slot.quantity}` : name;
}
