import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { formatHundredths, parseGlints, playerMessage } from "../chain/format";
import { getLive, type LivePlay } from "../chain/live";
import { buyListing, cancelListing, listItem, strikeAnvil } from "../chain/play";
import { uiText } from "../content/text";
import { charterValue, marketQuote, planStrike } from "../shared/economy";
import { useAnvil } from "./anvil";
import { ItemIcon } from "./ItemIcon";
import { itemLabel } from "./itemLabel";
import { BOUND, CRACKING, FORGING, LISTED, SEALED, useMarket, type ListingView } from "./market";
import { KIND_MEAL, isGear, usePack, type SlotView } from "./pack";
import { useHud } from "./store";

/** A sealed rimeshell may be sold unopened: that is the Coldfair's defining trade. */
const NOT_LISTABLE = BOUND | LISTED | CRACKING | FORGING;
/** The anvil takes at most eight fodder slots, and none that is bound, sealed, listed or mid-roll. */
const MAX_FODDER = 8;
const NOT_FODDER = BOUND | SEALED | LISTED | CRACKING | FORGING;
const PRICES = ["100", "500", "2500", "10000"];

/** Runs one market or anvil action against the live session, with the HUD busy while it lands. */
function run(action: (live: LivePlay) => Promise<void>): void {
  const live = getLive();
  if (!live) {
    useHud.getState().setNote(uiText("needSession"));
    return;
  }
  useHud.getState().setBusy(true);
  action(live)
    .catch((err: unknown) => useHud.getState().setNote(playerMessage(err)))
    .finally(() => useHud.getState().setBusy(false));
}

/** The purchase names the revision and price the buyer saw, so a changed listing is refused. */
function trade(live: LivePlay, listing: ListingView, mine: boolean): Promise<void> {
  const { rollup, session, owner, link } = live;
  if (mine) {
    return cancelListing(rollup, session.signer, owner, session.token, link, listing.id, listing.revision);
  }
  const seller = new PublicKey(listing.seller);
  return buyListing(rollup, session.signer, owner, session.token, link, listing.id, seller, listing.revision, listing.price);
}

function Listings({ owner }: { owner: string }) {
  const listings = useMarket((state) => state.listings);
  const busy = useHud((state) => state.busy);
  return (
    <>
      {listings.length === 0 ? <p className="dim">{uiText("noListings")}</p> : null}
      <ul className="slots">
        {listings.map((listing) => {
          const mine = listing.seller === owner;
          return (
            <li key={`${listing.id}:${listing.revision}`}>
              <span className="what">
                <ItemIcon item={listing} size={24} /> {itemLabel(listing)}
              </span>
              <span className="acts">
                <b className="dim">{formatHundredths(BigInt(listing.price))}</b>
                <button type="button" disabled={busy} onClick={() => run((live) => trade(live, listing, mine))}>
                  {uiText(mine ? "cancel" : "buy")}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Pick the item and the price, read the terms, then list: nothing is sent on a mere selection. */
function ListForm() {
  const slots = usePack((state) => state.slots);
  const busy = useHud((state) => state.busy);
  const [price, setPrice] = useState(PRICES[1]);
  const [slot, setSlot] = useState(-1);
  const listable = slots.filter((item) => (item.flags & NOT_LISTABLE) === 0 && item.kind !== KIND_MEAL);
  const chosen = listable.find((item) => item.slot === slot);
  const asked = BigInt(price);
  const quote = marketQuote(asked, false);

  function list(): void {
    if (!chosen) return;
    run(async (live) => {
      await listItem(live.rollup, live.session.signer, live.owner, live.session.token, live.link, chosen.slot, price);
      setSlot(-1);
    });
  }

  return (
    <>
      <div className="row">
        <select value={chosen ? slot : -1} onChange={(event) => setSlot(Number(event.target.value))}>
          <option value={-1}>{uiText("listFromPack")}</option>
          {listable.map((item) => (
            <option key={item.slot} value={item.slot}>
              {itemLabel(item)}
            </option>
          ))}
        </select>
        <select value={price} onChange={(event) => setPrice(event.target.value)}>
          {PRICES.map((option) => (
            <option key={option} value={option}>
              {formatHundredths(BigInt(option))}
            </option>
          ))}
        </select>
      </div>
      {chosen ? (
        <p className="dim">
          {uiText("deposit")} {formatHundredths(quote.deposit)} · {uiText("fee")} {formatHundredths(quote.fee)} ·{" "}
          {uiText("youGet")} {formatHundredths(asked - quote.fee)}
        </p>
      ) : null}
      <button type="button" disabled={busy || !chosen} onClick={list}>
        {uiText("listIt")}
      </button>
    </>
  );
}

/** A stack burns whole, so it is worth its unit price times its count, as on chain. */
function fodderValue(slots: SlotView[], fodder: number[]): bigint {
  return fodder.reduce((sum, slot) => {
    const candidate = slots.find((entry) => entry.slot === slot);
    if (!candidate) return sum;
    const units = candidate.id === "0" ? BigInt(candidate.quantity) : 1n;
    return sum + charterValue(candidate) * units;
  }, 0n);
}

function planFor(item: SlotView | undefined, extra: bigint, heat: number[]) {
  if (!item || !isGear(item.kind)) return null;
  const material = item.kind >= 17 ? 2 : item.kind >= 14 ? 1 : 0;
  return planStrike(material, item.rarity, charterValue(item) + extra, heat[item.rarity + 1] ?? 0);
}

function Anvil() {
  const slots = usePack((state) => state.slots);
  const heat = useAnvil((state) => state.heat);
  const busy = useHud((state) => state.busy);
  const [strikeSlot, setStrikeSlot] = useState(-1);
  const [fodder, setFodder] = useState<number[]>([]);
  const [glints, setGlints] = useState("0");
  const stake = parseGlints(glints);
  const item = slots.find((slot) => slot.slot === strikeSlot);
  const plan = planFor(item, fodderValue(slots, fodder) + (stake ?? 0n), heat);

  function toggleFodder(slot: number): void {
    setFodder((current) => {
      if (current.includes(slot)) return current.filter((entry) => entry !== slot);
      return current.length >= MAX_FODDER ? current : [...current, slot];
    });
  }

  function strike(): void {
    run(async (live) => {
      const fed = (stake ?? 0n).toString();
      await strikeAnvil(live.rollup, live.session.signer, live.owner, live.session.token, live.link, strikeSlot, fodder, fed);
      setFodder([]);
      setGlints("0");
      setStrikeSlot(-1);
    });
  }

  return (
    <>
      <div className="row">
        <select value={strikeSlot} onChange={(event) => setStrikeSlot(Number(event.target.value))}>
          <option value={-1}>{uiText("pickGear")}</option>
          {slots
            .filter((slot) => isGear(slot.kind) && (slot.flags & NOT_FODDER) === 0)
            .map((slot) => (
              <option key={slot.slot} value={slot.slot}>
                {itemLabel(slot)}
              </option>
            ))}
        </select>
      </div>
      <ul className="fodder">
        {slots
          .filter((slot) => slot.slot !== strikeSlot && (slot.flags & NOT_FODDER) === 0)
          .map((slot) => (
            <li key={slot.slot}>
              <label>
                <input type="checkbox" checked={fodder.includes(slot.slot)} onChange={() => toggleFodder(slot.slot)} />
                {itemLabel(slot)}
              </label>
            </li>
          ))}
      </ul>
      {plan ? (
        <p className="dim">
          {uiText("odds")} {plan.odds / 100}% · {uiText("fee")} {formatHundredths(plan.fee)}
        </p>
      ) : null}
      <input value={glints} onChange={(event) => setGlints(event.target.value)} placeholder={uiText("glintsFodder")} />
      <button type="button" disabled={busy || !plan || stake === null} onClick={strike}>
        {uiText("strike")}
      </button>
    </>
  );
}

export function ColdfairPanel({ owner }: { owner: string }) {
  return (
    <aside className="panel fair">
      <div className="col">
        <h2>{uiText("coldfair")}</h2>
        <Listings owner={owner} />
        <ListForm />
      </div>
      <div className="col">
        <h2>{uiText("anvil")}</h2>
        <Anvil />
      </div>
    </aside>
  );
}
