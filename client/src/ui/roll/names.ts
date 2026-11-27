// The words the roll reveals use, by the chain's own ids.
import type { UiKey } from "../../content/text";
import type { SegmentId, StripKind } from "./strip";

export const SHELL_NAME: UiKey[] = ["shellSmall", "shellMedium", "shellLarge", "shellCrater", "shellBoss"];
export const TONE_NAME: UiKey[] = ["toneDawn", "toneNoon", "toneBlueHour", "toneDusk"];
export const GRADE_NAME: UiKey[] = ["gradeDim", "gradeGlowing", "gradeBright", "gradeRadiant", "gradeBlazing"];
export const RARITY_NAME: UiKey[] = ["rarityCommon", "rarityUncommon", "rarityRare", "rarityEpic", "rarityLegendary"];

export const SEGMENT_NAME: Record<SegmentId, UiKey> = {
  dust: "rollSegDust",
  block: "rollSegBlock",
  second: "rollSegSecond",
  none: "rollSegNone",
  g0: "gradeDim",
  g1: "gradeGlowing",
  g2: "gradeBright",
  g3: "gradeRadiant",
  g4: "gradeBlazing",
};

export const STRIP_TITLE: Record<StripKind, UiKey> = {
  dust: "rollDustOrBlock",
  grade: "rollGrade",
  gradeFirst: "rollGradeFirst",
  gradeSecond: "rollGradeSecond",
  pair: "rollPair",
};
