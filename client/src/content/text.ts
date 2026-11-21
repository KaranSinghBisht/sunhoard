import ui from "./strings.ui.json";

export type UiKey = keyof typeof ui;

export function uiText(key: UiKey): string {
  return ui[key];
}
