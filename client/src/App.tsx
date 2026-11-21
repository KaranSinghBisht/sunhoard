import { useEffect, useState, type CSSProperties } from "react";
import { uiText } from "./content/text";
import { setTouring, useStage } from "./game/stage";
import { beginTale, firstVisit, useTale } from "./game/story/tale";
import { CellarButton } from "./ui/CellarButton";
import { Cinema } from "./ui/Cinema";
import { ClaimButton } from "./ui/ClaimButton";
import { Guide } from "./ui/Guide";
import { Hud } from "./ui/Hud";
import { InventoryPanel } from "./ui/InventoryPanel";
import { Labels } from "./ui/Labels";
import { Meadow } from "./ui/Meadow";
import { Quest } from "./ui/Quest";
import { Talk } from "./ui/Talk";
import { ThawPanel } from "./ui/ThawPanel";
import { TxLogPanel } from "./ui/TxLogPanel";
import { useFit } from "./ui/useFit";

export default function App() {
  const [packOpen, setPackOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const { zoom, wide } = useFit();
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
            <ClaimButton />
            <button type="button" className="quiet" onClick={() => setPackOpen((open) => !open)}>
              {uiText("pack")}
            </button>
            {packOpen ? <InventoryPanel /> : null}
            <ThawPanel />
          </div>
        </div>
      </div>
      {playing ? null : <Guide onBegin={begin} canRetell={onMeadow} />}
    </main>
  );
}
