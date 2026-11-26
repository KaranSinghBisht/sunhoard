type Control = "left" | "right" | "up" | "down" | "use" | "dash";
const held = new Map<number, Control>();
export function hold(id: number, control: Control) { held.set(id, control); }
export function release(id: number) { held.delete(id); }
export function pressed(control: Control) { return [...held.values()].includes(control); }
export function releaseAll() { held.clear(); }

export function textInput(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input,textarea,select,[contenteditable=true]"));
}
