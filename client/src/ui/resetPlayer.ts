import { setLive } from "../chain/live";
import { resetTxLog } from "../chain/txlog";
import { armChop } from "../chain/watch";
import { setChainFight } from "../game/fightFeed";
import { setChainLair } from "../game/lairFeed";
import { showScene, useStage } from "../game/stage";
import { useAnvil } from "./anvil";
import { useMarket } from "./market";
import { usePack } from "./pack";
import { useShells } from "./shells";
import { useHud } from "./store";
import { useVillage } from "./village";
import { useWorld } from "./world";

export function resetPlayer(): void {
  setLive(null);
  resetTxLog();
  armChop();
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
