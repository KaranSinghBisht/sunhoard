import Phaser from "phaser";
import { useEffect, useRef, type CSSProperties } from "react";
import { uiText } from "../content/text";
import { CellarScene } from "../game/CellarScene";
import { onIntent } from "../game/fightFeed";
import { clearLabels } from "../game/labels";
import { aimPractice, startPractice, stopPractice } from "../game/practice";
import { Labels } from "./Labels";
import { TouchControls } from "./TouchControls";
import { useFit } from "./useFit";

export default function Practice({ onExit }: { onExit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const { zoom } = useFit();
  useEffect(() => {
    if (!host.current) return;
    startPractice();
    onIntent(aimPractice);
    const created = new Phaser.Game({
      type: Phaser.AUTO, parent: host.current, width: 480, height: 270, zoom,
      pixelArt: true, roundPixels: true, banner: false, scene: CellarScene,
    });
    game.current = created;
    return () => {
      created.destroy(true);
      game.current = null;
      onIntent(() => undefined);
      stopPractice();
      clearLabels();
    };
  }, []);
  useEffect(() => { game.current?.scale.setZoom(zoom); }, [zoom]);
  return <main className="app" style={{ "--stage-w": `${zoom * 480}px`, "--zoom": zoom } as CSSProperties}>
    <div className="frame"><div className="hud"><strong className="brand">{uiText("title")}</strong>
      <button className="quiet" onClick={onExit}>{uiText("backTitle")}</button></div>
      <div className="view"><div className="stage" ref={host} /><Labels /></div>
      <TouchControls combat />
    </div>
  </main>;
}
