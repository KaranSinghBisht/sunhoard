import type { CSSProperties } from "react";
import { VIEW_H, VIEW_W, useLabels } from "../game/labels";

/** How close to the canvas's side a tag's centre may sit, as a share of its width. */
const EDGE = 0.17;

function share(value: number, of: number, min: number): string {
  return `${Math.min(1 - min, Math.max(min, value / of)) * 100}%`;
}

/** The game's own words, laid over the canvas at screen resolution so they stay sharp. */
export function Labels() {
  const tag = useLabels((state) => state.tag);
  const caption = useLabels((state) => state.caption);
  const badge = useLabels((state) => state.badge);
  const pops = useLabels((state) => state.pops);
  const place: CSSProperties | undefined = tag ? { left: share(tag.x, VIEW_W, EDGE), top: share(tag.y, VIEW_H, 0) } : undefined;
  return (
    <>
      {pops.map((pop) => (
        <span key={pop.id} className={`pop ${pop.tone}`} style={{ left: share(pop.x, VIEW_W, EDGE), top: share(pop.y, VIEW_H, 0) }}>
          {pop.text}
        </span>
      ))}
      {tag ? (
        <span className="tag" style={place}>
          {tag.text}
        </span>
      ) : null}
      {caption || badge ? (
        <div className="room-note" role="status">
          {caption ? <p>{caption}</p> : null}
          {badge ? <p className="badge">{badge}</p> : null}
        </div>
      ) : null}
    </>
  );
}
