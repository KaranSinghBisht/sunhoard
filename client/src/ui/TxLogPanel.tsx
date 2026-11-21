import { useTxLog } from "../chain/txlog";
import { uiText } from "../content/text";

/** Under this many ms a transaction feels instant: the rollup's whole point. */
const QUICK_MS = 150;

export function TxLogPanel() {
  const rows = useTxLog((state) => state.rows);
  const landed = useTxLog((state) => state.landed);
  const landedMs = useTxLog((state) => state.landedMs);
  const average = landed > 0 ? Math.round(landedMs / landed) : null;
  return (
    <aside className="panel txlog">
      <h2>{uiText("txlog")}</h2>
      {average === null ? (
        <p className="dim">{uiText("txEmpty")}</p>
      ) : (
        <p className="tally">
          <b>{landed}</b> {uiText("txCount")} · {uiText("txAverage")} <b>{average} ms</b>
        </p>
      )}
      <ul>
        {rows.map((row) => (
          <li key={row.id} className={row.ok ? "ok" : "bad"}>
            <span className="what">{row.instruction}</span>
            <span className={row.latencyMs <= QUICK_MS ? "ms quick" : "ms"}>{row.latencyMs} ms</span>
            {row.url ? (
              <a href={row.url} target="_blank" rel="noreferrer">
                {row.signature.slice(0, 6)}
              </a>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
