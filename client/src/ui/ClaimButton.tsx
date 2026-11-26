import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { formatHundredths, playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { walletSigner } from "../chain/login";
import { claimShare, keypairSigner } from "../chain/play";
import { formatSol, readPrize, type Prize } from "../chain/prize";
import { claimGlintsIx, openProgram } from "../chain/program";
import { sendInstruction } from "../chain/send";
import { uiText } from "../content/text";
import { useHud } from "./store";
import { useWorld } from "./world";

export function ClaimButton() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const busy = useHud((state) => state.busy);
  const ready = useHud((state) => state.sessionReady);
  const killed = useHud((state) => state.sunFree);
  const season = useWorld((state) => state.seasonNumber);
  const slayer = useWorld((s) => s.slayers.find((row) => row.wallet === publicKey?.toBase58()));
  const [record, setRecord] = useState<Prize | "error" | null>(null);
  const [revision, refresh] = useState(0);
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const live = getLive();
    setRecord(null);
    if (!publicKey || !ready || !live || !publicKey.equals(live.owner)) return;
    async function read() {
      try {
        const value = await readPrize(connection, live!.owner);
        if (active && getLive() === live) setRecord(value);
      } catch {
        if (active && getLive() === live) setRecord("error");
      } finally {
        if (active && getLive() === live) timer = setTimeout(() => void read(), 15_000);
      }
    }
    void read();
    return () => { active = false; clearTimeout(timer); };
  }, [connection, publicKey, ready, season, killed, revision]);

  useEffect(() => {
    if (!record || record === "error" || !record.until) return;
    setNow(Date.now() / 1000);
    const remaining = record.until * 1000 - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(Date.now() / 1000), remaining + 25);
    return () => clearTimeout(timer);
  }, [record]);

  async function collect(unit: "glints" | "sol"): Promise<void> {
    const live = getLive();
    if (!publicKey || !live || !publicKey.equals(live.owner)) return;
    const hud = useHud.getState();
    hud.setBusy(true);
    try {
      if (unit === "sol") {
        if (!signTransaction) throw new Error(uiText("needSession"));
        await claimShare(connection, walletSigner(publicKey, signTransaction, () => getLive() === live));
      } else {
        const ix = await claimGlintsIx(openProgram(live.rollup), live.session.signer.publicKey, live.owner, live.session.token, season);
        await sendInstruction(live.rollup, keypairSigner(live.session.signer), [], ix, "claim_glints", "rollup", live.link);
      }
      if (getLive() === live) hud.setNote(uiText(unit === "sol" ? "claimed" : "glintsReceived"));
    } catch (err) {
      if (getLive() === live) hud.setNote(playerMessage(err));
    } finally {
      if (getLive() === live) { hud.setBusy(false); refresh((n) => n + 1); }
    }
  }

  if (!ready || !publicKey || !record) return null;
  if (record === "error") return <small>{uiText("payoutUnavailable")}</small>;
  if (record.owner !== publicKey.toBase58()) return null;
  const current = killed && record.season === season;
  const open = !record.until || now < record.until;
  const glints = current && !slayer?.glintsClaimed ? slayer?.glintAward ?? 0n : 0n;
  const sol = record.claimed ? 0n : record.amount;
  return <>
    <small>{uiText("devnetPrize")} {formatSol(record.funded)}</small>
    {killed && !current && <small>{uiText("basePending")}</small>}
    {current && open && record.until > 0 && <small>{uiText("claimDeadline")} {new Date(record.until * 1000).toLocaleString()}</small>}
    {current && !open && <small>{uiText("claimsClosed")}</small>}
    {current && open && sol === 0n && glints === 0n &&
      <small>{uiText(record.claimed || slayer?.glintsClaimed ? "awardsClaimed" : "noAward")}</small>}
    {open && glints > 0n && <button disabled={busy} onClick={() => void collect("glints")}>
      {uiText("claim")} {formatHundredths(glints)} {uiText("glintPrize")}
    </button>}
    {open && sol > 0n && <button disabled={busy || !signTransaction} onClick={() => void collect("sol")}>
      {uiText("claim")} {formatSol(sol)} {uiText("devnetSol")}
    </button>}
  </>;
}
