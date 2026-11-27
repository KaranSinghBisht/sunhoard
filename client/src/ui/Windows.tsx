import { useEffect } from "react";
import { uiText } from "../content/text";
import { CheatPanel } from "./CheatPanel";
import { ColdfairPanel } from "./ColdfairPanel";
import { GuidePanel } from "./GuidePanel";
import { HeldSlot } from "./HeldSlot";
import { InventoryPanel } from "./InventoryPanel";
import { usePanel } from "./panel";
import { ThawPanel } from "./ThawPanel";
import { TxLogPanel } from "./TxLogPanel";

/**
 * Everything that opens over the game screen: one window at a time, and the
 * rollup feed as a strip in the corner. `small` is a canvas too small to hold
 * a window, where it covers the page instead.
 */
export function Windows({ owner, small }: { owner: string; small: boolean }) {
  const panel = usePanel((state) => state.panel);
  const feed = usePanel((state) => state.feed);
  const close = usePanel((state) => state.close);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close]);

  return (
    <>
      <HeldSlot />
      {feed ? (
        <div className="feed-dock">
          <TxLogPanel />
        </div>
      ) : null}
      {panel ? (
        <div
          className={small ? "shade whole" : "shade"}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section className={`window ${panel}`} role="dialog" aria-label={uiText(panel)}>
            <button type="button" className="quiet shut" onClick={close}>
              {uiText("close")}
            </button>
            {panel === "pack" ? <InventoryPanel /> : null}
            {panel === "coldfair" ? <ColdfairPanel owner={owner} /> : null}
            {panel === "guide" ? <GuidePanel /> : null}
            {panel === "thaw" ? <ThawPanel /> : null}
            {panel === "cheat" ? <CheatPanel /> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
