import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { parseGlints, playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { buyListing, cancelListing, listItem, strikeAnvil } from "../chain/play";
import { uiText, type UiKey } from "../content/text";
import { planStrike, useAnvil } from "./anvil";
import { BOUND, CRACKING, FORGING, LISTED, SEALED, useMarket, type ListingView } from "./market";
import { isGear, usePack, type SlotView } from "./pack";
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
const CHARTER: Record<number, number> = { 1: 50, 2: 40, 3: 50, 4: 150, 5: 50, 6: 200, 7: 25, 8: 400, 9: 150, 10: 10, 11: 25 };
const GRADE_PRICE = [5_000, 9_000, 16_000, 32_000, 80_000];
/** The anvil takes at most eight fodder slots, and none that is bound, sealed, listed or mid-roll. */
const MAX_FODDER = 8;
const NOT_FODDER = BOUND | SEALED | LISTED | CRACKING | FORGING;

/** The item's Charter value in hundredths, mirroring logic/merchant.rs. */
function charterValue(slot: SlotView): number {
  if (slot.flags & SEALED) return 0;
  if (isGear(slot.kind)) {
    const material = slot.kind >= 17 ? 2 : slot.kind >= 14 ? 1 : 0;
    const base = [100, 500, 800][material];
    return (base * [10_000, 24_000, 60_000, 160_000, 500_000][slot.rarity]) / 10_000;
  }
  if (slot.kind === 0) {
    return (GRADE_PRICE[slot.grade] * (7_500 + slot.purityBp / 2)) / 10_000;
  }
  return CHARTER[slot.kind] ?? 0;
}

function describe(listing: ListingView): string {
  if (listing.flags & SEALED) return uiText(SHELL_NAME[listing.shell] ?? "shellSmall");
  if (isGear(listing.kind)) {
    return `${uiText(KIND_NAME[listing.kind] ?? "gearIronAxe")} · ${uiText(RARITY_NAME[listing.rarity] ?? "rarityCommon")}`;
  }
  if (listing.kind === 0) {
    return `${uiText(TONE_NAME[listing.tone] ?? "toneDawn")} ${uiText(GRADE_NAME[listing.grade] ?? "gradeDim")} block`;
  }
  const name = uiText(KIND_NAME[listing.kind] ?? "kindWood");
  return listing.quantity > 1 ? `${name} ×${listing.quantity}` : name;
}

export function ColdfairPanel({ owner }: { owner: string }) {
  const listings = useMarket((state) => state.listings);
  const slots = usePack((state) => state.slots);
  const heat = useAnvil((state) => state.heat);
  const busy = useHud((state) => state.busy);
  const [price, setPrice] = useState("100");
  const [strikeSlot, setStrikeSlot] = useState(-1);
  const [fodder, setFodder] = useState<number[]>([]);
  const [glints, setGlints] = useState("0");

  function run(action: () => Promise<void>): void {
    const live = getLive();
    if (!live) {
      useHud.getState().setNote(uiText("needSession"));
      return;
    }
    useHud.getState().setBusy(true);
    action()
      .catch((err) => useHud.getState().setNote(playerMessage(err)))
      .finally(() => useHud.getState().setBusy(false));
  }

  const listable = slots.filter((slot) => (slot.flags & (BOUND | SEALED)) === 0 && slot.kind !== 9);
  const item = strikeSlot >= 0 ? slots.find((slot) => slot.slot === strikeSlot) : undefined;
  // A stack burns whole, so it is worth its unit price times its count, as on chain.
  const fodderValue = fodder.reduce((sum, slot) => {
    const candidate = slots.find((entry) => entry.slot === slot);
    if (!candidate) return sum;
    const units = candidate.id === "0" ? candidate.quantity : 1;
    return sum + charterValue(candidate) * units;
  }, 0);
  const stake = parseGlints(glints);
  const plan = item && isGear(item.kind)
    ? (() => {
        const material = item.kind >= 17 ? 2 : item.kind >= 14 ? 1 : 0;
        const inputs = charterValue(item) + fodderValue + Number(stake ?? 0n);
        return planStrike(material, item.rarity, inputs, heat[item.rarity + 1] ?? 0);
      })()
    : null;

  function toggleFodder(slot: number): void {
    setFodder((current) => {
      if (current.includes(slot)) return current.filter((entry) => entry !== slot);
      return current.length >= MAX_FODDER ? current : [...current, slot];
    });
  }

  return (
    <aside className="panel">
      <h2>{uiText("coldfair")}</h2>
      {listings.length === 0 ? <p className="dim">{uiText("noListings")}</p> : null}
      <ul className="slots">
        {listings.map((listing) => {
          const mine = listing.seller === owner;
          return (
            <li key={listing.id}>
              <span className="what">{describe(listing)}</span>
              <span className="acts">
                <b className="dim">{Number(listing.price) / 100}</b>
                {mine ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const live = getLive()!;
                        await cancelListing(live.rollup, live.session.signer, live.owner, live.session.token, live.link, listing.id);
                      })
                    }
                  >
                    {uiText("cancel")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const live = getLive()!;
                        await buyListing(live.rollup, live.session.signer, live.owner, live.session.token, live.link, listing.id, new PublicKey(listing.seller));
                      })
                    }
                  >
                    {uiText("buy")}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="row">
        <select value={price} onChange={(event) => setPrice(event.target.value)}>
          <option value="100">1.00</option>
          <option value="500">5.00</option>
          <option value="2500">25.00</option>
          <option value="10000">100.00</option>
        </select>
        <select
          value={-1}
          onChange={(event) => {
            const slot = Number(event.target.value);
            if (slot < 0) return;
            run(async () => {
              const live = getLive()!;
              await listItem(live.rollup, live.session.signer, live.owner, live.session.token, live.link, slot, price);
            });
          }}
        >
          <option value={-1}>{uiText("listFromPack")}</option>
          {listable.map((slot) => (
            <option key={slot.slot} value={slot.slot}>
              {uiText(KIND_NAME[slot.kind] ?? "kindWood")} {slot.slot}
            </option>
          ))}
        </select>
      </div>

      <h2>{uiText("anvil")}</h2>
      <div className="row">
        <select value={strikeSlot} onChange={(event) => setStrikeSlot(Number(event.target.value))}>
          <option value={-1}>{uiText("pickGear")}</option>
          {slots
            .filter((slot) => isGear(slot.kind))
            .map((slot) => (
              <option key={slot.slot} value={slot.slot}>
                {uiText(KIND_NAME[slot.kind] ?? "gearIronAxe")} {slot.slot}
              </option>
            ))}
        </select>
      </div>
      <ul className="fodder">
        {slots
          .filter((slot) => slot.slot !== strikeSlot && (slot.flags & NOT_FODDER) === 0 && !isGear(slot.kind))
          .map((slot) => (
            <li key={slot.slot}>
              <label>
                <input type="checkbox" checked={fodder.includes(slot.slot)} onChange={() => toggleFodder(slot.slot)} />
                {uiText(KIND_NAME[slot.kind] ?? "kindWood")} {slot.slot}
              </label>
            </li>
          ))}
      </ul>
      {plan ? (
        <p className="dim">
          {uiText("odds")} {plan.odds / 100}% · {uiText("fee")} {plan.fee / 100}
        </p>
      ) : null}
      <input value={glints} onChange={(event) => setGlints(event.target.value)} placeholder={uiText("glintsFodder")} />
      <button
        type="button"
        disabled={busy || !plan || stake === null}
        onClick={() =>
          run(async () => {
            const live = getLive()!;
            const fed = (stake ?? 0n).toString();
            await strikeAnvil(live.rollup, live.session.signer, live.owner, live.session.token, live.link, strikeSlot, fodder, fed);
            setFodder([]);
            setGlints("0");
            setStrikeSlot(-1);
          })
        }
      >
        {uiText("strike")}
      </button>
    </aside>
  );
}
