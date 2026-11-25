import { useEffect, useState, type CSSProperties } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { uiText } from "./content/text";
import { setTouring, useStage } from "./game/stage";
import { beginTale, firstVisit, useTale } from "./game/story/tale";
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
import { TxLogPanel } from "./ui/TxLogPanel";
import { useFit } from "./ui/useFit";

export default function App() {
  const [packOpen, setPackOpen] = useState(false);
  const [fairOpen, setFairOpen] = useState(false);
  const [barnOpen, setBarnOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const { zoom, wide } = useFit();
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58() ?? "";
  const cinema = useTale((state) => state.beat !== null);
  const talking = useTale((state) => state.talk !== null);
  const onMeadow = useStage((state) => state.scene === "overworld");
  // The opening and a conversation take the whole canvas; the panels come back after.
  const panels = playing && !cinema;

  function begin(retell: boolean): void {
    // A first visit gets the opening once; coming back from the title card mid-walk does not restart it.
    const fresh = firstVisit() && useTale.getState().arrivals === 0;
    if (retell || fresh) beginTale();
    setPlaying(true);
  }

  useEffect(() => {
    setTouring(!playing);
  }, [playing]);

  useEffect(() => {
    if (!playing) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "e" || event.key === "E") setPackOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  const frame = { "--stage-w": `${480 * zoom}px`, "--zoom": zoom } as CSSProperties;

  // The meadow stays mounted under the tale, so going back to read it keeps the session and the keeper's place.
  return (
    <main className={`app ${wide ? "wide" : "tight"}`} style={frame}>
      <div className={cinema ? "frame in-cinema" : "frame"}>
        {playing ? <Hud onTale={() => setPlaying(false)} /> : null}
        <div className="view">
          <Meadow zoom={zoom} gate={panels && !talking && onMeadow} />
          {panels ? <Labels /> : null}
          {panels ? <Quest narrow={!onMeadow} /> : null}
          {playing ? <Cinema /> : null}
          {panels ? <Talk /> : null}
          <div className="side left" hidden={!panels}>
            <TxLogPanel />
          </div>
          <div className="side right rail" hidden={!panels}>
            <CellarButton />
            <LairButton />
            <ClaimButton />
            <button type="button" className="quiet" onClick={() => setPackOpen((open) => !open)}>
              {uiText("pack")}
            </button>
            <button type="button" className="quiet" onClick={() => setFairOpen((open) => !open)}>
              {uiText("coldfair")}
            </button>
            <button type="button" className="quiet" onClick={() => setBarnOpen((open) => !open)}>
              {uiText("barn")}
            </button>
            {packOpen ? <InventoryPanel /> : null}
            {fairOpen ? <ColdfairPanel owner={owner} /> : null}
            {barnOpen ? <BarnPanel /> : null}
            <ThawPanel />
          </div>
        </div>
      </div>
      {playing ? null : <Guide onBegin={begin} canRetell={onMeadow} />}
    </main>
  );
}
