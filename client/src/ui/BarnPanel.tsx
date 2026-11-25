import { useState } from "react";
import { playerMessage } from "../chain/format";
import { getLive } from "../chain/live";
import { collectGoods, feedVillage, hireWanderer, ringHearthBell, setGem, unsetGem } from "../chain/play";
import { uiText } from "../content/text";
import { KIND_FOOD, usePack } from "./pack";
import { useHud } from "./store";
import { useVillage } from "./village";

const PROFESSION = ["", "Woodcutter", "Miner", "Farmer", "Smith"];
const GRADE_NAME = ["Dim", "Glowing", "Bright", "Radiant", "Blazing"];

export function BarnPanel() {
  const village = useVillage();
  const slots = usePack((state) => state.slots);
  const busy = useHud((state) => state.busy);
  const [foodSlot, setFoodSlot] = useState(-1);

  function run(action: () => Promise<void>): void {
    const live = getLive();
    if (!live) {
      useHud.getState().setNote(uiText("needSession"));
      return;
    }
    useHud.getState().setBusy(true);
    action()
      .catch((err) => useHud.getState().setNote(playerMessage(err)))
      .finally(() => useHud.getState().setBusy(false));
  }

  const blocks = slots.filter((slot) => slot.kind === 0 && (slot.flags & 1) === 0);
  const meals = slots.filter((slot) => slot.kind === KIND_FOOD);

  return (
    <aside className="panel">
      <h2>{uiText("barn")}</h2>
      <p className="dim">
        {uiText("warmth")} {village.warmth / 100} · {uiText("beds")} {village.beds} · {uiText("workstations")} {village.workstations}
      </p>
      <ul className="slots">
        {village.posts
          .filter((post) => post.built || post.hasBlock)
          .map((post) => (
            <li key={post.index}>
              <span className="what">
                {post.hasBlock ? `${GRADE_NAME[post.grade]} block` : uiText("emptyPost")} {post.index}
              </span>
              <span className="acts">
                {post.hasBlock ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const live = getLive()!;
                        await unsetGem(live.rollup, live.session.signer, live.owner, live.session.token, live.link, post.index);
                      })
                    }
                  >
                    {uiText("takeBack")}
                  </button>
                ) : null}
              </span>
            </li>
          ))}
      </ul>
      <div className="row">
        <select
          value={-1}
          onChange={(event) => {
            const slot = Number(event.target.value);
            if (slot < 0) return;
            run(async () => {
              const live = getLive()!;
              await setGem(live.rollup, live.session.signer, live.owner, live.session.token, live.link, slot);
            });
          }}
        >
          <option value={-1}>{uiText("setBlock")}</option>
          {blocks.map((slot) => (
            <option key={slot.slot} value={slot.slot}>
              block {slot.slot}
            </option>
          ))}
        </select>
      </div>
      <ul className="slots">
        {village.villagers.map((villager) => (
          <li key={villager.index}>
            <span className="what">
              {villager.wanderer ? uiText("wanderer") : PROFESSION[villager.profession] ?? "?"}
              {villager.bound ? ` · ${uiText("boundTag")}` : ""}
            </span>
            <span className="acts">
              {villager.wanderer ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const live = getLive()!;
                      await hireWanderer(live.rollup, live.session.signer, live.owner, live.session.token, live.link, villager.index);
                    })
                  }
                >
                  {uiText("recruit")}
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy || village.bellBusy}
        onClick={() =>
          run(async () => {
            const live = getLive()!;
            await ringHearthBell(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
          })
        }
      >
        {uiText("ringBell")}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const live = getLive()!;
            await collectGoods(live.rollup, live.session.signer, live.owner, live.session.token, live.link);
          })
        }
      >
        {uiText("collect")}
      </button>
      <div className="row">
        <select value={foodSlot} onChange={(event) => setFoodSlot(Number(event.target.value))}>
          <option value={-1}>{uiText("feed")}</option>
          {meals.map((slot) => (
            <option key={slot.slot} value={slot.slot}>
              food {slot.slot}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || foodSlot < 0}
          onClick={() =>
            run(async () => {
              const live = getLive()!;
              await feedVillage(live.rollup, live.session.signer, live.owner, live.session.token, live.link, foodSlot);
              setFoodSlot(-1);
            })
          }
        >
          {uiText("feed")}
        </button>
      </div>
    </aside>
  );
}
