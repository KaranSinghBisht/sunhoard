// Words that belong to the game world but are drawn by the page, not the canvas.
// The canvas is 480×270 and scaled up, so letters drawn in it come out too coarse to read.
import { create } from "zustand";

export const VIEW_W = 480;
export const VIEW_H = 270;

export interface Tag {
  text: string;
  /** Centre of the tag on the canvas, in canvas px. */
  x: number;
  y: number;
}

/** A result that floats up from where it happened and fades: "+2 Wood". */
export interface Pop {
  id: number;
  text: string;
  x: number;
  y: number;
  tone: "gain" | "bonus" | "miss";
}

/** How long a pop stays, ms; the page's animation runs the same length. */
const POP_MS = 1800;
let popId = 0;

interface Labels {
  pops: Pop[];
  /** The tag over the thing Space would use, on the meadow. */
  tag: Tag | null;
  /** The line under the fight, in the cellar. */
  caption: string;
  /** A standing notice with the caption, such as the practice-room one. */
  badge: string;
}

export const useLabels = create<Labels>(() => ({ pops: [], tag: null, caption: "", badge: "" }));

export function showTag(text: string, x: number, y: number): void {
  const next = { text, x: Math.round(x), y: Math.round(y) };
  const { tag } = useLabels.getState();
  if (tag && tag.text === next.text && tag.x === next.x && tag.y === next.y) return;
  useLabels.setState({ tag: next });
}

export function showPop(text: string, x: number, y: number, tone: Pop["tone"]): void {
  popId += 1;
  const id = popId;
  useLabels.setState((state) => ({ pops: [...state.pops, { id, text, x: Math.round(x), y: Math.round(y), tone }] }));
  window.setTimeout(() => useLabels.setState((state) => ({ pops: state.pops.filter((pop) => pop.id !== id) })), POP_MS);
}

export function hideTag(): void {
  if (useLabels.getState().tag) useLabels.setState({ tag: null });
}

export function showRoomNote(caption: string, badge: string): void {
  const now = useLabels.getState();
  if (now.caption === caption && now.badge === badge) return;
  useLabels.setState({ caption, badge });
}

export function clearLabels(): void {
  useLabels.setState({ pops: [], tag: null, caption: "", badge: "" });
}
