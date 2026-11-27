// How the camera frames a fight room: zoomed in so the room spills past the
// canvas instead of floating in a dark margin, following the keeper.
import type Phaser from "phaser";
import { ORIGIN_X, ORIGIN_Y, ROOM, WALL } from "../cellar/room";

/** A whole number keeps the 16 px tiles crisp on the 480×270 canvas. */
export const ROOM_ZOOM = 2;

export function frameRoom(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite): void {
  const camera = scene.cameras.main;
  camera.setZoom(ROOM_ZOOM);
  camera.setBounds(ORIGIN_X - WALL, ORIGIN_Y - WALL, ROOM + WALL * 2, ROOM + WALL * 2);
  camera.startFollow(target, true, 0.2, 0.2);
  camera.centerOn(target.x, target.y);
}

/** True when the player asked the system for less motion: no screen shakes then. */
export function calmMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
