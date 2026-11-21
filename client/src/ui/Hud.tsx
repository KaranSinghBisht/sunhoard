import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { formatHundredths } from "../chain/format";
import { uiText } from "../content/text";
import { useHud } from "./store";

const COIN = "/assets/vendor/ninja-adventure/coin.png";

export function Hud({ onTale }: { onTale: () => void }) {
  const energy = useHud((state) => state.energy);
  const glints = useHud((state) => state.glints);
  const pot = useHud((state) => state.pot);
  const note = useHud((state) => state.note);
  const { publicKey } = useWallet();
  return (
    <header className="hud">
      <strong className="brand">{uiText("title")}</strong>
      <span className="chip">
        {uiText("energy")} <b>{energy ?? "–"}</b>
      </span>
      <span className="chip">
        <img src={COIN} alt="" />
        {uiText("glints")} <b>{glints === null ? "–" : formatHundredths(glints)}</b>
      </span>
      <span className="chip pot">
        {uiText("pot")} <b>{pot === null ? "–" : formatHundredths(pot)}</b>
      </span>
      <p className="note" role="status">
        {note}
      </p>
      <button type="button" className="quiet" onClick={onTale}>
        {uiText("tale")}
      </button>
      {publicKey ? <WalletMultiButton /> : null}
    </header>
  );
}
