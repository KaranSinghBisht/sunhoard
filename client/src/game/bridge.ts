import { uiText } from "../content/text";
import { useHud } from "../ui/store";
export interface MoveReport {
  x: number;
  y: number;
  facing: number;
}

export interface ChopReport {
  x: number;
  y: number;
  nodeX: number;
  nodeY: number;
  node?: number;
}

interface Bridge {
  move: (report: MoveReport) => void;
  chop: (report: ChopReport) => void;
}

const idle: Bridge = {
  move: () => undefined,
  chop: () => undefined,
};

let bridge: Bridge = idle;

export function setBridge(next: Bridge): void {
  bridge = next;
}

export function gameBridge(): Bridge {
  return bridge;
}

/** With no session nobody owns the dungeon flow, so the knock says why nothing opens. */
const closedDoor = (): void => useHud.getState().setNote(uiText("knockFirst"));
let door: () => void = closedDoor;

/** The cellar door: the scene knocks, whoever owns the dungeon flow answers. `null` hands it back. */
export function onDoor(next: (() => void) | null): void {
  door = next ?? closedDoor;
}

export function knock(): void {
  door();
}
