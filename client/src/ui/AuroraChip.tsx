import { useEffect, useState } from "react";
import { uiText } from "../content/text";
import { useStage } from "../game/stage";
import { auroraNow } from "../shared/aurora";

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** When the aurora is up, and what a gather rolls at right now: the reason to come back this half hour. */
export function AuroraChip() {
  const scene = useStage((state) => state.scene);
  const [aurora, setAurora] = useState(auroraNow);
  useEffect(() => {
    const timer = window.setInterval(() => setAurora(auroraNow()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (scene !== "overworld") return null;
  return (
    <p className={aurora.up ? "aurora-chip up" : "aurora-chip"} role="status">
      <b>{uiText(aurora.up ? "auroraUp" : "auroraDown")} {clock(aurora.left)}</b>
      <span>
        {uiText("auroraOdds")} {aurora.oneIn}
      </span>
    </p>
  );
}
