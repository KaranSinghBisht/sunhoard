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

interface Labels {
  /** The tag over the thing Space would use, on the meadow. */
  tag: Tag | null;
  /** The line under the fight, in the cellar. */
  caption: string;
  /** A standing notice with the caption, such as the practice-room one. */
  badge: string;
}

export const useLabels = create<Labels>(() => ({ tag: null, caption: "", badge: "" }));

export function showTag(text: string, x: number, y: number): void {
  const next = { text, x: Math.round(x), y: Math.round(y) };
  const { tag } = useLabels.getState();
  if (tag && tag.text === next.text && tag.x === next.x && tag.y === next.y) return;
  useLabels.setState({ tag: next });
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
  useLabels.setState({ tag: null, caption: "", badge: "" });
}
