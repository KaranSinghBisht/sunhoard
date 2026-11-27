import { useEffect, useRef, useState } from "react";
import { playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { advanceRoom, aimRoom, enterRoom, leaveRoom } from "../chain/play";
import { refreshArena } from "../chain/watch";
import { uiText } from "../content/text";
import { onDoor } from "../game/bridge";
import { onRoomExit } from "../game/fight/exit";
import { onFightChange, onIntent, readChainFight } from "../game/fightFeed";
import { useStage } from "../game/stage";
import type { Fight } from "../shared/fight";
import { useHud } from "./store";

/** True when the chain room is cleared and the keeper may advance or bank. */
function roomCleared(fight: Fight | null): boolean {
  if (!fight) return false;
  return fight.player.hp > 0 && fight.foes.length > 0 && fight.foes.every((foe) => foe.body.hp <= 0);
}

export function CellarButton() {
  const busy = useHud((state) => state.busy);
  const scene = useStage(state => state.scene);
  const inside = scene === "cellar";
  const [cleared, setCleared] = useState(() => roomCleared(readChainFight().fight));
  const [room, setRoom] = useState(() => readChainFight().fight?.room ?? 1);
  const knock = useRef<() => void>(() => undefined);
  const wayOut = useRef<() => void>(() => undefined);

  useEffect(() => {
    onIntent((intent) => {
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
      ).catch((err: unknown) => getLive() === live && useHud.getState().setNote(playerMessage(err)));
    });
    return () => onIntent(() => undefined);
  }, []);

  useEffect(() => {
    const stop = onFightChange((fight) => {
      setCleared(roomCleared(fight));
      setRoom(fight?.room ?? 1);
    });
    return stop;
  }, []);

  async function go(): Promise<void> {
    const live = getLive();
    if (!live) return;
    useHud.getState().setBusy(true);
    try {
      if (inside) {
        // Read at the press, not at the last render: Space can arrive before React has redrawn.
        const now = readChainFight().fight;
        if (roomCleared(now) && (now?.room ?? 1) < 6) {
          await advanceRoom(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
        } else {
          await leaveRoom(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
        }
      } else {
        await enterRoom(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
      }
      await refreshArena();
    } catch (err) {
      if (getLive() === live) useHud.getState().setNote(playerMessage(err));
    } finally {
      if (getLive() === live) useHud.getState().setBusy(false);
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
    return () => onDoor(null);
  }, []);

  // Space or Enter in a finished room does the same as this button; the scene asks (game/fight/exit.ts).
  useEffect(() => {
    wayOut.current = () => {
      const fight = readChainFight().fight;
      const over = roomCleared(fight) || (fight !== null && fight.player.hp <= 0);
      if (inside && over && !useHud.getState().busy) void go();
    };
  });

  useEffect(() => {
    onRoomExit(() => wayOut.current());
    return () => onRoomExit(null);
  }, []);

  return (
    <button type="button" disabled={busy || scene === "lair"} onClick={() => void go()}>
      {inside ? (cleared && room < 6 ? uiText("nextRoom") : uiText("leave")) : uiText("cellar")}
    </button>
  );
}
