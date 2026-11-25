export const FLOOR = "/assets/vendor/ninja-adventure/tileset-floor.png";
export const NATURE = "/assets/vendor/ninja-adventure/tileset-nature.png";
export const CAMP = "/assets/vendor/ninja-adventure/camp.png";
export const KEEPER = "/assets/vendor/ninja-adventure/keeper.png";
export const SLIME = "/assets/vendor/ninja-adventure/slime.png";
export const MOUSE = "/assets/vendor/ninja-adventure/mouse.png";
export const BAT = "/assets/vendor/ninja-adventure/bat.png";
export const SNOW = "/assets/vendor/ninja-adventure/snow.png";
export const DETAIL = "/assets/vendor/ninja-adventure/floor-detail.png";
export const HOUSE = "/assets/vendor/ninja-adventure/tileset-house.png";
export const RELIEF = "/assets/vendor/ninja-adventure/relief-detail.png";
export const FIRE = "/assets/vendor/ninja-adventure/fire.png";
export const NELL = "/assets/vendor/ninja-adventure/nell.png";
export const NELL_FACE = "/assets/vendor/ninja-adventure/nell-face.png";
export const SHADOW = "/assets/vendor/ninja-adventure/shadow.png";
export const DUNGEON = "/assets/vendor/kenney-tiny-dungeon/tilemap.png";
export const DRAGON_HEAD = "/assets/vendor/ninja-adventure/dragon/head.png";
export const DRAGON_WING = "/assets/vendor/ninja-adventure/dragon/wing.png";
export const DRAGON_BODY1 = "/assets/vendor/ninja-adventure/dragon/body1.png";
export const DRAGON_BODY2 = "/assets/vendor/ninja-adventure/dragon/body2.png";
export const DRAGON_TAIL = "/assets/vendor/ninja-adventure/dragon/tail.png";
export const SPIRIT_IDLE = "/assets/vendor/ninja-adventure/spirit/idle.png";
export const SPARK = "/assets/vendor/ninja-adventure/spark.png";
export const PETAL = "/assets/vendor/ninja-adventure/petal.png";

const WALK = [1, 2, 3, 2];

export function keeperColumn(dx: number, dy: number, previous: number): number {
  if (dx === 0 && dy === 0) return previous;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 2 : 3;
  return dy < 0 ? 1 : 0;
}

export function keeperFrame(column: number, moving: boolean, time: number): number {
  const row = moving ? WALK[Math.floor(time / 140) % WALK.length] : 0;
  return row * 4 + column;
}
