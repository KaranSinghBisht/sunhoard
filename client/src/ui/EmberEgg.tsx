import { useState } from "react";
import { playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { nameNextWyrm } from "../chain/play";
import { uiText } from "../content/text";
import { useHud } from "./store";
import { useWorld } from "./world";

/** The program takes A–Z and spaces, 16 at most; the same rule is applied here before anything is sent. */
const NAME_RULE = /^[A-Z ]{1,16}$/;

/** The killing blow wins the Ember Egg, and whoever holds it names the next season's wyrm. */
export function EmberEgg({ owner }: { owner: string }) {
  const holder = useWorld((state) => state.emberHolder);
  const hasEmber = useWorld((state) => state.hasEmber);
  const wyrmName = useWorld((state) => state.wyrmName);
  const busy = useHud((state) => state.busy);
  const [name, setName] = useState("");
  const typed = name.trim().toUpperCase();

  async function send(): Promise<void> {
    const live = getLive();
    if (!live || !NAME_RULE.test(typed)) return;
    useHud.getState().setBusy(true);
    try {
      await nameNextWyrm(live.rollup, live.session.signer, live.owner, live.session.token, live.link, typed);
      if (getLive() === live) useHud.getState().setNote(`${uiText("wyrmNamed")} ${typed}`);
    } catch (err) {
      if (getLive() === live) useHud.getState().setNote(playerMessage(err));
    } finally {
      if (getLive() === live) useHud.getState().setBusy(false);
    }
  }

  if (hasEmber && holder === owner) {
    return (
      <div className="row ember">
        <small>{uiText("emberEgg")}</small>
        <input
          value={name}
          maxLength={16}
          onChange={(event) => setName(event.target.value)}
          placeholder={uiText("wyrmRule")}
          aria-label={uiText("emberEgg")}
        />
        <button type="button" disabled={busy || !NAME_RULE.test(typed)} onClick={() => void send()}>
          {uiText("nameWyrm")}
        </button>
      </div>
    );
  }
  return wyrmName ? (
    <small>
      {uiText("wyrmNamed")} {wyrmName}
    </small>
  ) : null;
}
