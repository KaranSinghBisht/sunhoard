import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { playerMessage } from "../chain/format";
import { walletSigner } from "../chain/login";
import { claimShare } from "../chain/play";
import { uiText } from "../content/text";
import { useHud } from "./store";

export function ClaimButton() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const busy = useHud((state) => state.busy);

  async function claim(): Promise<void> {
    if (!publicKey || !signTransaction) return;
    const hud = useHud.getState();
    hud.setBusy(true);
    try {
      await claimShare(connection, walletSigner(publicKey, signTransaction));
      hud.setNote(uiText("claimed"));
    } catch (err) {
      hud.setNote(playerMessage(err));
    } finally {
      hud.setBusy(false);
    }
  }

  return (
    <button type="button" disabled={!publicKey || busy} onClick={() => void claim()}>
      {uiText("claim")}
    </button>
  );
}
