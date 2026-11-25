import { uiText } from "../content/text";
import { log } from "./log";

export function formatHundredths(value: bigint): string {
  const negative = value < 0n;
  const amount = negative ? -value : value;
  const whole = amount / 100n;
  const frac = (amount % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/** Reads what a player typed as Glints into hundredths; null when it is not an amount. */
export function parseGlints(text: string): bigint | null {
  const typed = text.trim();
  if (typed === "") return 0n;
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(typed);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

const PLAIN_LIMIT = 90;
const ADDRESS = /[1-9A-HJ-NP-Za-km-z]{32,}/;

/** A line safe to show a player: the program's own message, a known refusal, or a plain fallback. */
export function playerMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  const said = /Error Message: ([^\n]+?\.)(\s|$)/.exec(raw);
  if (said) return said[1];
  const line = raw.split("\n")[0] ?? "";
  if (/reject|denied|declin|cancel/i.test(line)) return uiText("declined");
  const plain = line.length > 0 && line.length <= PLAIN_LIMIT && !ADDRESS.test(line) && !line.includes("0x");
  if (plain) return line;
  log(`hidden from the player: ${line.slice(0, 200)}`);
  return uiText("rejected");
}
