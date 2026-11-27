import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { formatHundredths, playerMessage } from "../chain/format";
import { getLive, type LivePlay } from "../chain/live";
import { buyListing, cancelListing, listItem } from "../chain/play";
import { uiText } from "../content/text";
import { marketQuote } from "../shared/economy";
import { ItemIcon } from "./ItemIcon";
import { itemLabel } from "./itemLabel";
import { BOUND, CRACKING, FORGING, LISTED, useMarket, type ListingView } from "./market";
import { KIND_MEAL, usePack } from "./pack";
import { Anvil } from "./roll/Anvil";
import { useHud } from "./store";

/** A sealed rimeshell may be sold unopened: that is the Coldfair's defining trade. */
const NOT_LISTABLE = BOUND | LISTED | CRACKING | FORGING;
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
  const purse = useHud((state) => state.glints);
  const [price, setPrice] = useState(PRICES[1]);
  const [slot, setSlot] = useState(-1);
  const listable = slots.filter((item) => (item.flags & NOT_LISTABLE) === 0 && item.kind !== KIND_MEAL);
  const chosen = listable.find((item) => item.slot === slot);
  const asked = BigInt(price);
  const quote = marketQuote(asked, false);
  // The deposit is taken when the listing is made; a purse below it is refused on chain.
  const short = purse !== null && purse < quote.deposit;

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
      {short && purse !== null ? (
        <p className="roll-warn">
          {uiText("rollListNeed")} {formatHundredths(quote.deposit)} {uiText("rollListHave")} {formatHundredths(purse)}.{" "}
          {uiText("rollListHow")}
        </p>
      ) : null}
      <button type="button" disabled={busy || !chosen || short} onClick={list}>
        {uiText("listIt")}
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
