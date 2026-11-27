import { useEffect, useState, type CSSProperties } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { uiText } from "./content/text";
import { setTouring, useStage } from "./game/stage";
import { textInput } from "./game/touch";
import { beginTale, useTale } from "./game/story/tale";
import { CellarButton } from "./ui/CellarButton";
import { Cinema } from "./ui/Cinema";
import { EmberEgg } from "./ui/EmberEgg";
import { ClaimButton } from "./ui/ClaimButton";
import { Guide } from "./ui/Guide";
import { Hud } from "./ui/Hud";
import { Labels } from "./ui/Labels";
import { LairButton } from "./ui/LairButton";
import { Meadow } from "./ui/Meadow";
import { Quest } from "./ui/Quest";
import { Talk } from "./ui/Talk";
import { TouchControls } from "./ui/TouchControls";
import { useFit } from "./ui/useFit";
import { usePanel, type PanelId } from "./ui/panel";
import { Windows } from "./ui/Windows";
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
          {panels && ready && <Windows key={owner} owner={owner} small={zoom < 2} />}
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

const DO: PanelId[] = ["pack", "coldfair", "thaw"];
/** Set once the How to play window has been opened in this browser. */
const GUIDE_SEEN = "sunhoard.guideSeen";

function guideSeen(): boolean {
  try {
    return window.localStorage.getItem(GUIDE_SEEN) !== null;
  } catch {
    // Storage can be blocked; the button then simply stays highlighted.
    return false;
  }
}

function markGuideSeen(): void {
  try {
    window.localStorage.setItem(GUIDE_SEEN, "1");
  } catch {
    // Nothing to do: the highlight is a convenience, not state the game needs.
  }
}

/** The buttons under the game, in three groups. The windows they open are drawn over the game screen. */
function PlayerActions({ owner }: { owner: string }) {
  const panel = usePanel(state => state.panel);
  const feed = usePanel(state => state.feed);
  const toggle = usePanel(state => state.toggle);
  const toggleFeed = usePanel(state => state.toggleFeed);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (textInput(event.target) || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === "e") usePanel.getState().toggle("pack");
      if (event.key.toLowerCase() === "h") usePanel.getState().toggle("guide");
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      // A wallet change remounts this row; the next player starts with nothing open.
      usePanel.getState().reset();
    };
  }, []);
  const [fresh, setFresh] = useState(() => !guideSeen());
  useEffect(() => {
    if (panel !== "guide" || !fresh) return;
    markGuideSeen();
    setFresh(false);
  }, [panel, fresh]);
  const opener = (id: PanelId) =>
    <button type="button" key={id} className="quiet" aria-expanded={panel === id} onClick={() => toggle(id)}>{uiText(id)}</button>;
  return (
    <div className="actions">
      <span className="group"><b>{uiText("groupGo")}</b><CellarButton /><LairButton /></span>
      <span className="group"><b>{uiText("groupDo")}</b>{DO.map(opener)}</span>
      <span className="group"><b>{uiText("groupProof")}</b>{opener("cheat")}
        <button type="button" className="quiet" aria-pressed={feed} onClick={toggleFeed}>{uiText("txlog")}</button></span>
      <span className={fresh ? "group fresh" : "group"}>{opener("guide")}</span>
      <span className="group wide"><ClaimButton /><EmberEgg owner={owner} /></span>
    </div>
  );
}
