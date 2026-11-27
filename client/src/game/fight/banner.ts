// The notice over the canvas when a room is done: what happened and which key moves on.
// Drawn by the page (sharp letters), placed by the scene that knows when to show it.
// Styles live in fight.css.
export class Banner {
  private readonly box: HTMLDivElement | null;
  private readonly title: HTMLElement | null;
  private readonly hint: HTMLElement | null;
  private shown = "";

  /** `host` is the element the canvas sits in; with none (no page) the banner is a no-op. */
  constructor(host: HTMLElement | null) {
    if (!host) {
      this.box = this.title = this.hint = null;
      return;
    }
    this.box = document.createElement("div");
    this.box.className = "fight-banner";
    this.box.setAttribute("role", "status");
    this.box.hidden = true;
    this.title = this.box.appendChild(document.createElement("strong"));
    this.hint = this.box.appendChild(document.createElement("span"));
    host.appendChild(this.box);
  }

  /** `tone` picks the colours: a win or a fall. */
  show(title: string, hint: string, tone: "won" | "fell"): void {
    const key = `${tone}|${title}|${hint}`;
    if (!this.box || !this.title || !this.hint || key === this.shown) return;
    this.shown = key;
    this.title.textContent = title;
    this.hint.textContent = hint;
    this.box.className = `fight-banner ${tone}`;
    this.box.hidden = false;
  }

  hide(): void {
    if (!this.box || this.shown === "") return;
    this.shown = "";
    this.box.hidden = true;
  }

  destroy(): void {
    this.box?.remove();
  }
}
