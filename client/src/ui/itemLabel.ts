import { uiText, type UiKey } from "../content/text";
import { isGear, SEALED, type SlotView } from "./pack";

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

/** The plain name of a stackable kind, such as "Wood". */
export function kindName(kind: number): string {
  return uiText(KIND_NAME[kind] ?? "unknownItem");
}

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

function itemName(slot: {
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
    const name = uiText(KIND_NAME[slot.kind] ?? "unknownItem");
    const rarity = uiText(RARITY_NAME[slot.rarity] ?? "rarityCommon");
    const traits = slot.traits
      .map((pair) => `${uiText(TRAIT_NAME[pair.id] ?? "unknownTrait")} ${TIERS[pair.tier] ?? ""}`)
      .join(", ");
    return traits ? `${name} · ${rarity} · ${traits}` : `${name} · ${rarity}`;
  }
  if (slot.kind === 0) {
    const tone = uiText(TONE_NAME[slot.tone] ?? "toneDawn");
    const grade = uiText(GRADE_NAME[slot.grade] ?? "gradeDim");
    const purity = (slot.purityBp / 100).toFixed(2) + "%";
    return `${tone} ${grade} ${uiText("blockLabel")} · ${uiText("purity")} ${purity}`;
  }
  const name = uiText(KIND_NAME[slot.kind] ?? "unknownItem");
  return slot.quantity > 1 ? `${name} ×${slot.quantity}` : name;
}

export function itemLabel(item: Pick<SlotView, "kind" | "quantity" | "rarity" | "traits" | "tone" | "grade" | "purityBp" | "shell" | "flags">): string {
  const label = itemName(item);
  return (item.flags & 64) !== 0 ? `${label} · ${uiText("demoItemTag")}` : label;
}
