import { create } from "zustand";

export type MusicKey = "meadow" | "cellar" | "lair" | "spring";
export type SfxKey = "chop" | "mine" | "coin" | "bell" | "thaw" | "anvil" | "hit" | "slash" | "powerup";

interface SoundState {
  muted: boolean;
  toggle: () => void;
}

export const useSound = create<SoundState>((set) => ({
  muted: false,
  toggle: () =>
    set((state) => {
      const next = !state.muted;
      if (music) music.muted = next;
      return { muted: next };
    }),
}));

let unlocked = false;
let currentTrack: MusicKey | null = null;
let music: HTMLAudioElement | null = null;

function canPlay(): boolean {
  return typeof Audio !== "undefined" && typeof window !== "undefined";
}

export function unlockAudio(): void {
  if (unlocked || !canPlay()) return;
  unlocked = true;
  if (currentTrack) playMusic(currentTrack);
}

export function playMusic(track: MusicKey): void {
  currentTrack = track;
  if (!canPlay() || !unlocked) return;
  const src = `/assets/vendor/audio/${track}.mp3`;
  if (music && music.dataset.track === track) {
    music.muted = useSound.getState().muted;
    void music.play().catch(() => undefined);
    return;
  }
  if (music) {
    music.pause();
    music = null;
  }
  const el = new Audio(src);
  el.dataset.track = track;
  el.loop = true;
  el.volume = 0.28;
  el.muted = useSound.getState().muted;
  music = el;
  void el.play().catch(() => undefined);
}

export function playSfx(sfx: SfxKey, volume = 0.45): void {
  if (!canPlay() || useSound.getState().muted) return;
  unlocked = true;
  const el = new Audio(`/assets/vendor/audio/${sfx}.mp3`);
  el.volume = volume;
  void el.play().catch(() => undefined);
}
