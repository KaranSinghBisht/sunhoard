import { useEffect, useRef } from "react";
import { playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { log } from "../chain/log";
import { aimLair, enterCrater, leaveCrater, scoopSpark } from "../chain/play";
import { uiText } from "../content/text";
import { onLairChange, onLairIntent, readChainLair } from "../game/lairFeed";
import { useStage } from "../game/stage";
import { useWorld } from "./world";
import { useHud } from "./store";

export function LairButton() {
  const busy = useHud((state) => state.busy);
  const sparkNear = useHud((state) => state.sparkNear);
  const sunFree = useHud((state) => state.sunFree);
  const phase = useWorld((state) => state.phase);
  const scene = useStage(state => state.scene);
  const inside = scene === "lair";
  const running = useRef(Boolean(readChainLair().lair));
  const leaving = useRef(false);

  useEffect(() => {
    onLairIntent((intent) => {
      const live = getLive();
      if (!live || useStage.getState().scene !== "lair") return;
      void aimLair(
        live.rollup,
        live.session.signer,
        live.owner,
        live.session.token,
        live.link,
        intent.dx,
        intent.dy,
        intent.attack ? 1 : 0,
        intent.dash ? 1 : 0,
      ).catch((err: unknown) => getLive() === live && useHud.getState().setNote(playerMessage(err)));
    });
    return () => onLairIntent(() => undefined);
  }, []);

  useEffect(() => {
    // The visit ends by itself when its steps run out, the keeper falls or Old Gloam dies.
    const stop = onLairChange((lair) => {
      if (useStage.getState().scene !== "lair") return;
      if (lair) {
        running.current = true;
        return;
      }
      if (!running.current || readChainLair().waiting) return;
      running.current = false;
      useHud.getState().setSparkNear(false);
      if (!leaving.current && getLive()) {
        useHud.getState().setNote(uiText(useHud.getState().sunFree ? "sunFree" : "craterOver"));
        void stopCrank();
      }
    });
    return stop;
  }, []);

  /** The visit is over but its crank may still be scheduled; leaving cancels it. */
  async function stopCrank(): Promise<void> {
    const live = getLive();
    if (!live) return;
    try {
      await leaveCrater(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
    } catch (err) {
      log(`the ended visit had nothing left to stop: ${err instanceof Error ? err.message.slice(0, 120) : "unknown"}`);
    }
  }

  async function go(): Promise<void> {
    const live = getLive();
    if (!live) {
      useHud.getState().setNote(uiText("needSession"));
      return;
    }
    useHud.getState().setBusy(true);
    try {
      if (inside) {
        leaving.current = true;
        await leaveCrater(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
      } else {
        await enterCrater(live.rollup, live.session.signer, live.owner, live.session.token, live.link);

      }
    } catch (err) {
      if (getLive() === live) useHud.getState().setNote(playerMessage(err));
    } finally {
      leaving.current = false;
      if (getLive() === live) useHud.getState().setBusy(false);
    }
  }

  async function scoop(): Promise<void> {
    const live = getLive();
    if (!live) return;
    useHud.getState().setBusy(true);
    try {
      await scoopSpark(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
    } catch (err) {
      if (getLive() === live) useHud.getState().setNote(playerMessage(err));
    } finally {
      leaving.current = false;
      if (getLive() === live) useHud.getState().setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy || scene === "cellar" || (sunFree && !inside)}
        title={sunFree && !inside ? uiText("sunFree") : undefined}
        onClick={() => void go()}
      >
        {inside ? uiText("leaveCrater") : uiText("crater")}
      </button>
      {inside && sparkNear ? (
        <button type="button" disabled={busy} onClick={() => void scoop()}>
          {uiText("catchSpark")}
        </button>
      ) : null}
    </>
  );
}
