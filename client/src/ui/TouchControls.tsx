import { useEffect } from "react";
import { uiText, type UiKey } from "../content/text";
import { hold, release, releaseAll } from "../game/touch";

export function TouchControls({ combat }: { combat: boolean }) {
  useEffect(() => {
    window.addEventListener("blur", releaseAll);
    return () => { releaseAll(); window.removeEventListener("blur", releaseAll); };
  }, [combat]);
  function key(control: Parameters<typeof hold>[1], label: UiKey, symbol?: string) {
    return <button type="button" key={control} aria-label={uiText(label)}
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); hold(event.pointerId, control); }}
      onPointerUp={event => release(event.pointerId)} onLostPointerCapture={event => release(event.pointerId)}
      onPointerCancel={event => release(event.pointerId)}>{symbol ?? uiText(label)}</button>;
  }
  return <div className="touch-controls" role="group" aria-label={uiText("touchMove")}>
    <div className="dpad">{key("up","touchUp","↑")}{key("left","touchLeft","←")}{key("down","touchDown","↓")}{key("right","touchRight","→")}</div>
    <div>{key("use", combat ? "touchAttack" : "touchUse")}{combat && key("dash","touchDash")}</div>
  </div>;
}
