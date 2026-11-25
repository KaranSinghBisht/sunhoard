import { useEffect, useRef, useState } from "react";
import { playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { advanceRoom, aimRoom, enterRoom, leaveRoom } from "../chain/play";
import { uiText } from "../content/text";
import { onDoor } from "../game/bridge";
import { onFightChange, onIntent } from "../game/fightFeed";
import { aimPractice, practising, startPractice, stopPractice } from "../game/practice";
import { showScene } from "../game/stage";
import type { Fight } from "../shared/fight";
import { useHud } from "./store";

/** True when the chain room is cleared and the keeper may advance or bank. */
function roomCleared(fight: Fight | null): boolean {
  if (!fight) return false;
  return fight.player.hp > 0 && fight.foes.length > 0 && fight.foes.every((foe) => foe.body.hp <= 0);
}

export function CellarButton() {
  const busy = useHud((state) => state.busy);
  const [inside, setInside] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [room, setRoom] = useState(1);
  const knock = useRef<() => void>(() => undefined);

  useEffect(() => {
    onIntent((intent) => {
      if (practising()) {
        aimPractice(intent);
        return;
      }
      const live = getLive();
      if (!live) return;
      void aimRoom(
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
    const stop = onFightChange((fight) => {
      setCleared(roomCleared(fight));
      setRoom(fight?.room ?? 1);
    });
    return stop;
  }, []);

  /** With no session there is no chain room to enter, so open the local practice room and say so. */
  function practise(): void {
    if (inside) {
      stopPractice();
      showScene("overworld");
      useHud.getState().setNote("");
    } else {
      startPractice();
      showScene("cellar");
      useHud.getState().setNote(uiText("practiceNote"));
    }
    setInside(!inside);
  }

  async function go(): Promise<void> {
    const live = getLive();
    if (!live || practising()) {
      practise();
      return;
    }
    useHud.getState().setBusy(true);
    try {
      if (inside) {
        if (cleared && room < 6) {
          await advanceRoom(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
          setCleared(false);
        } else {
          await leaveRoom(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
          showScene("overworld");
          setInside(false);
          setCleared(false);
        }
      } else {
        await enterRoom(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
        showScene("cellar");
        setInside(true);
      }
    } catch (err) {
      useHud.getState().setNote(playerMessage(err));
    } finally {
      useHud.getState().setBusy(false);
    }
  }

  // Space at the cave mouth in the meadow does the same as this button.
  useEffect(() => {
    knock.current = () => {
      if (!busy && !inside) void go();
    };
  });

  useEffect(() => {
    onDoor(() => knock.current());
    return () => onDoor(() => undefined);
  }, []);

  return (
    <button type="button" disabled={busy} onClick={() => void go()}>
      {inside ? (cleared && room < 6 ? uiText("nextRoom") : uiText("leave")) : uiText("cellar")}
    </button>
  );
}
