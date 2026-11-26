import { useEffect, useState, type CSSProperties } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { uiText } from "./content/text";
import { setTouring, useStage } from "./game/stage";
import { textInput } from "./game/touch";
import { beginTale, useTale } from "./game/story/tale";
import { BarnPanel } from "./ui/BarnPanel";
import { CellarButton } from "./ui/CellarButton";
import { Cinema } from "./ui/Cinema";
import { ClaimButton } from "./ui/ClaimButton";
import { ColdfairPanel } from "./ui/ColdfairPanel";
import { Guide } from "./ui/Guide";
import { Hud } from "./ui/Hud";
import { InventoryPanel } from "./ui/InventoryPanel";
import { Labels } from "./ui/Labels";
import { LairButton } from "./ui/LairButton";
import { Meadow } from "./ui/Meadow";
import { Quest } from "./ui/Quest";
import { Talk } from "./ui/Talk";
import { ThawPanel } from "./ui/ThawPanel";
import { TouchControls } from "./ui/TouchControls";
import { TxLogPanel } from "./ui/TxLogPanel";
import { useFit } from "./ui/useFit";
import { useHud } from "./ui/store";

export default function App({ onExit }: { onExit: () => void }) {
  const [playing, setPlaying] = useState(true);
  const { zoom, wide } = useFit();
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58() ?? "";
  const cinema = useTale((state) => state.beat !== null);
  const talking = useTale((state) => state.talk !== null);
  const scene = useStage(state => state.scene);
  const ready = useHud(state => state.sessionReady);
  useEffect(() => { setTouring(!playing); }, [playing]);
  const panels = playing && !cinema;
  const frame = { "--stage-w": `${480 * zoom}px`, "--zoom": zoom } as CSSProperties;
  return (
    <main className={`app ${wide ? "wide" : "tight"}`} style={frame}>
      <div className={cinema ? "frame in-cinema" : "frame"}>
        {playing && <Hud onTale={() => setPlaying(false)} />}
        <div className="view">
          <Meadow zoom={zoom} gate={panels && !talking && scene === "overworld"} />
          {panels && <Labels />}
          {playing && <Cinema />}
          {panels && <Talk />}
        </div>
        {panels && <TouchControls combat={scene !== "overworld"} />}
        {panels && <Quest narrow={scene !== "overworld"} />}
        {panels && ready && <PlayerActions key={owner} owner={owner} />}
        {panels && <button type="button" className="quiet back-title" onClick={onExit}>{uiText("backTitle")}</button>}
      </div>
      {!playing && <Guide canRetell={scene === "overworld"} onBegin={retell => {
        if (retell) beginTale();
        setPlaying(true);
      }} />}
    </main>
  );
}

function PlayerActions({ owner }: { owner: string }) {
  const [panel, setPanel] = useState<"pack" | "coldfair" | "barn" | "thaw" | "txlog" | null>(null);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (textInput(event.target) || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === "e") setPanel(current => current === "pack" ? null : "pack");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return <>
    <div className="actions"><CellarButton /><LairButton /><ClaimButton />
      {(["pack", "coldfair", "barn", "thaw", "txlog"] as const).map(id =>
        <button type="button" key={id} className="quiet" aria-expanded={panel === id}
          onClick={() => setPanel(panel === id ? null : id)}>{uiText(id)}</button>)}
    </div>
    {panel === "pack" && <InventoryPanel />}
    {panel === "coldfair" && <ColdfairPanel owner={owner} />}
    {panel === "barn" && <BarnPanel />}
    {panel === "thaw" && <ThawPanel />}
    {panel === "txlog" && <TxLogPanel />}
  </>;
}
