import { BlockArt, ShellArt } from "./BlockArt";
import { SEALED } from "./pack";

const BASE = "/assets/vendor/ninja-adventure/items/";

/** Kind ids from logic/ids.rs to an icon from the Ninja Adventure pack. */
const ICON: Record<number, string> = {
  1: "branch",
  2: "rock",
  3: "rock",
  4: "ore",
  5: "meat",
  6: "honey",
  7: "crate",
  8: "bar",
  9: "noodle",
  10: "stick",
  11: "seed",
  12: "axe",
  13: "pickaxe",
  14: "axe",
  15: "pickaxe",
  16: "sword",
  17: "axe",
  18: "pickaxe",
  19: "blade",
};

/** One icon serves three materials: the tint tells stone, iron and gilded apart. */
const TINT: Record<number, string> = { 3: "coal", 12: "stone", 13: "stone", 17: "gilded", 18: "gilded", 19: "gilded" };

export interface IconItem {
  kind: number;
  flags: number;
  shell: number;
  tone: number;
  grade: number;
  purityBp: number;
  pattern?: number;
}

/** A sealed shell shows only its size; a Magic Block is drawn from its own traits. */
export function ItemIcon({ item, size = 32 }: { item: IconItem; size?: number }) {
  if ((item.flags & SEALED) !== 0) return <ShellArt shell={item.shell} size={size} px={16} />;
  if (item.kind === 0) {
    const spec = { tone: item.tone, grade: item.grade, purityBp: item.purityBp, pattern: item.pattern ?? 0 };
    return <BlockArt spec={spec} size={size} px={16} />;
  }
  const name = ICON[item.kind];
  if (!name) return null;
  const tint = TINT[item.kind];
  return (
    <img className={tint ? `pixel-art icon ${tint}` : "pixel-art icon"} src={`${BASE}${name}.png`} width={size} height={size} alt="" />
  );
}
