import { useEffect, useState } from "react";

const GAME_W = 480;
const GAME_H = 270;
/** Room kept for the page margin and for the HUD bar above the canvas, px. */
const MARGIN_X = 24;
const MARGIN_Y = 84;
/** Width one side panel needs to sit beside the canvas instead of over it, px. */
const SIDE = 264;

export interface Fit {
  /** Whole-number scale of the 480×270 canvas: pixel art stays crisp only at integers. */
  zoom: number;
  /** True when the side panels fit beside the canvas. */
  wide: boolean;
}

export function fitFor(width: number, height: number): Fit {
  const zoom = Math.max(1, Math.floor(Math.min((width - MARGIN_X) / GAME_W, (height - MARGIN_Y) / GAME_H)));
  return { zoom, wide: width - GAME_W * zoom >= SIDE * 2 };
}

export function useFit(): Fit {
  const [fit, setFit] = useState<Fit>(() => fitFor(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const measure = () => setFit(fitFor(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return fit;
}
