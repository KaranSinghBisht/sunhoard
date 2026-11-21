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

let door: () => void = () => undefined;

/** The cellar door: the scene knocks, whoever owns the dungeon flow answers. */
export function onDoor(next: () => void): void {
  door = next;
}

export function knock(): void {
  door();
}
