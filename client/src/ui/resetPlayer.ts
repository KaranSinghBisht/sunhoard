import { setLive } from "../chain/live";
import { resetTxLog } from "../chain/txlog";
import { setChainFight } from "../game/fightFeed";
import { resetGather } from "../game/gatherState";
import { setChainLair } from "../game/lairFeed";
import { showScene, useStage } from "../game/stage";
import { useAnvil } from "./anvil";
import { useMarket } from "./market";
import { usePack } from "./pack";
import { useShells } from "./shells";
import { useHud } from "./store";
import { useVillage } from "./village";
import { useWorld } from "./world";

/** A failed entry keeps its receipts: the refused sign-up is exactly what the player needs to see. */
export function resetPlayer(keepReceipts = false): void {
  setLive(null);
  if (!keepReceipts) resetTxLog();
  resetGather();
  setChainFight(null, false);
  setChainLair(null, false);
  if (useStage.getState().scene !== "overworld") showScene("overworld");
  useHud.setState(useHud.getInitialState(), true);
  useAnvil.setState(useAnvil.getInitialState(), true);
  useMarket.setState(useMarket.getInitialState(), true);
  usePack.setState(usePack.getInitialState(), true);
  useShells.setState(useShells.getInitialState(), true);
  useVillage.setState(useVillage.getInitialState(), true);
  useWorld.setState(useWorld.getInitialState(), true);
}
