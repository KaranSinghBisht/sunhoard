import { uiText } from "../content/text";
import { useHud } from "./store";

export function InventoryPanel() {
  const stacks = useHud((state) => state.stacks);
  return (
    <aside className="panel pack">
      <h2>{uiText("inventory")}</h2>
      {stacks ? (
        <p>
          {uiText("filled")} {stacks}
        </p>
      ) : (
        <p>{uiText("emptyPack")}</p>
      )}
    </aside>
  );
}
