import { useEffect, useRef, useState } from "react";
import { playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { log } from "../chain/log";
import { aimLair, enterCrater, leaveCrater, scoopSpark } from "../chain/play";
import { uiText } from "../content/text";
import { onLairChange, onLairIntent, readChainLair } from "../game/lairFeed";
import { showScene } from "../game/stage";
import { useHud } from "./store";

export function LairButton() {
  const busy = useHud((state) => state.busy);
  const sparkNear = useHud((state) => state.sparkNear);
  const sunFree = useHud((state) => state.sunFree);
  const [inside, setInside] = useState(false);
  /** True once the chain has shown this visit running; a later empty arena means it ended. */
  const running = useRef(false);
  const insideNow = useRef(false);

  function setIn(next: boolean): void {
    insideNow.current = next;
    running.current = false;
    setInside(next);
  }

  function backToMeadow(note: string): void {
    showScene("overworld");
    setIn(false);
    useHud.getState().setSparkNear(false);
    if (note) useHud.getState().setNote(note);
  }

  useEffect(() => {
    onLairIntent((intent) => {
      const live = getLive();
      if (!live || !insideNow.current) return;
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
      ).catch((err: unknown) => useHud.getState().setNote(playerMessage(err)));
    });
  }, []);

  useEffect(() => {
    // The visit ends by itself when its steps run out, the keeper falls or Old Gloam dies.
    const stop = onLairChange((lair) => {
      if (!insideNow.current) return;
      if (lair) {
        running.current = true;
        return;
      }
      if (!running.current || readChainLair().waiting) return;
      backToMeadow(useHud.getState().sunFree ? uiText("sunFree") : uiText("craterOver"));
      void stopCrank();
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

  async function leave(): Promise<void> {
    const live = getLive();
    if (!live) return;
    try {
      await leaveCrater(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
      backToMeadow("");
    } catch (err) {
      // The chain already closed the visit: nothing holds the keeper in the Crater.
      const over = running.current && !readChainLair().lair && !readChainLair().waiting;
      if (over) backToMeadow(uiText("craterOver"));
      else useHud.getState().setNote(playerMessage(err));
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
        await leave();
      } else {
        await enterCrater(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
        showScene("lair");
        setIn(true);
      }
    } catch (err) {
      useHud.getState().setNote(playerMessage(err));
    } finally {
      useHud.getState().setBusy(false);
    }
  }

  async function scoop(): Promise<void> {
    const live = getLive();
    if (!live) return;
    useHud.getState().setBusy(true);
    try {
      await scoopSpark(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
    } catch (err) {
      useHud.getState().setNote(playerMessage(err));
    } finally {
      useHud.getState().setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy || (sunFree && !inside)}
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
