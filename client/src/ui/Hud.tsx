import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useSound } from "../art/sound";
import { formatHundredths } from "../chain/format";
import { uiText } from "../content/text";
import { useHud } from "./store";

const COIN = "/assets/vendor/ninja-adventure/coin.png";

export function Hud({ onTale }: { onTale: () => void }) {
  const energy = useHud((state) => state.energy);
  const glints = useHud((state) => state.glints);
  const pot = useHud((state) => state.pot);
  const note = useHud((state) => state.note);
  const sunFree = useHud((state) => state.sunFree);
  const muted = useSound((state) => state.muted);
  const toggleSound = useSound((state) => state.toggle);
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
      {sunFree ? <span className="chip pot">{uiText("spring")}</span> : null}
      <p className="note" role="status">
        {note}
      </p>
      <button
        type="button"
        className={muted ? "quiet mute off" : "quiet mute"}
        onClick={toggleSound}
        aria-pressed={muted}
        title={uiText(muted ? "muted" : "sound")}
      >
        {uiText("sound")}
      </button>
      <button type="button" className="quiet" onClick={onTale}>
        {uiText("tale")}
      </button>
      {publicKey ? <WalletMultiButton /> : null}
    </header>
  );
}
