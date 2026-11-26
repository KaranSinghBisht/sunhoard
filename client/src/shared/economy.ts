import * as rules from "../gen/economy";

const BP = 10_000n;
const MAX_U64 = (1n << 64n) - 1n;
const charter = new Map<number, number>(rules.CHARTER_MATERIAL);
const shop = new Map<number, number>([...rules.SHOP_PRICE, ...rules.GEAR_SHOP_PRICE]);

export function shopPrice(kind: number): bigint {
  return BigInt(shop.get(kind) ?? 0);
}

interface ValuedItem {
  kind: number;
  flags: number;
  rarity: number;
  grade: number;
  purityBp: number;
}

/** Charter value of one unit. Sealed items are ineligible as anvil fodder. */
export function charterValue(item: ValuedItem): bigint {
  if (item.flags & 1) return 0n;
  if (item.kind === 0) {
    if (!Number.isInteger(item.purityBp) || item.purityBp < 0 || item.purityBp > 10_000) return 0n;
    const grade = BigInt(rules.GRADE_PRICE_HUNDREDTHS[item.grade] ?? 0);
    return grade * (BigInt(rules.BLOCK_PRICE_BASE_BP) + BigInt(item.purityBp) / 2n) / BP;
  }
  if (item.kind >= 12 && item.kind <= 19) {
    const material = item.kind >= 17 ? 2 : item.kind >= 14 ? 1 : 0;
    return gearValue(material, item.rarity);
  }
  return BigInt(charter.get(item.kind) ?? 0);
}

function gearValue(material: number, rarity: number): bigint {
  return BigInt(rules.GEAR_BASE_HUNDREDTHS[material] ?? 0) * BigInt(rules.RARITY_PRICE_BP[rarity] ?? 0) / BP;
}

export function planStrike(material: number, rarity: number, inputsValue: bigint, heat: number) {
  const target = gearValue(material, rarity + 1);
  const scaled = inputsValue * BigInt(rules.BASE_ODDS_BP);
  if (target === 0n || rarity < 0 || scaled < 0n || scaled > MAX_U64) return null;
  const pre = scaled / target;
  if (pre < BigInt(rules.REFUSE_BELOW_BP)) return null;
  const heated = pre + BigInt(Math.min(heat, rules.HEAT_CAP)) * 100n;
  const odds = heated < BigInt(rules.ODDS_CAP_BP) ? Number(heated) : rules.ODDS_CAP_BP;
  return { pre: Number(pre), odds, fee: target * BigInt(rules.STRIKE_FEE_BP) / BP };
}

export function marketQuote(price: bigint, firstLight: boolean) {
  const fee = firstLight ? 0n : price * BigInt(rules.HEARTH_PENNY_BP) / BP;
  const pot = fee / 2n;
  return { fee, pot, burned: fee - pot, deposit: BigInt(rules.LISTING_DEPOSIT_HUNDREDTHS) };
}
