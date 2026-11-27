// One gather from Space to the end of its roll: the base yield, then the VRF
// callback, each told to the player as it lands.
import type { Connection, Keypair, PublicKey } from "@solana/web3.js";
import type { Program } from "@coral-xyz/anchor";
import { uiText } from "../content/text";
import { resetGather, rollLanded, swingFailed, swingLanded } from "../game/gatherState";
import { tell } from "../game/story/tale";
import { auroraNow } from "../shared/aurora";
import { kindName } from "../ui/itemLabel";
import { usePack } from "../ui/pack";
import { useHud } from "../ui/store";
import { playerMessage } from "./format";
import { connectionActive } from "./ownership";
import { chopTree } from "./play";
import { openProgram } from "./program";
import { gatherPending, pullPack } from "./watch";

/** The chain gives up on a roll after 30 s; the page asks this often until then. */
const ROLL_POLL_MS = 400;
const ROLL_WAIT_MS = 30_000;
/** Under this much energy a refused chop is almost surely an empty tank. */
const LOW_ENERGY = 5;

type Totals = Map<number, number>;

function totals(): Totals {
  const out: Totals = new Map();
  for (const slot of usePack.getState().slots) {
    if (slot.kind !== 0) out.set(slot.kind, (out.get(slot.kind) ?? 0) + slot.quantity);
  }
  return out;
}

/** What the pack gained between two readings, as "+2 Wood, +1 Seed". Empty when nothing was added. */
function gained(before: Totals, after: Totals): string {
  const parts: string[] = [];
  for (const [kind, quantity] of after) {
    const more = quantity - (before.get(kind) ?? 0);
    if (more > 0) parts.push(`+${more} ${kindName(kind)}`);
  }
  return parts.join(", ");
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Waits for the VRF callback to clear the pending flag. False when it never came. */
async function rollArrives(rollup: Connection, program: Program, owner: PublicKey): Promise<boolean> {
  const until = Date.now() + ROLL_WAIT_MS;
  while (Date.now() < until && connectionActive(rollup)) {
    if ((await gatherPending(rollup, program, owner)) === false) return true;
    await pause(ROLL_POLL_MS);
  }
  return false;
}

/** The second half: the roll. It adds an aberration to the pack, or nothing. */
async function awaitRoll(rollup: Connection, program: Program, owner: PublicKey, base: Totals): Promise<void> {
  const arrived = await rollArrives(rollup, program, owner);
  if (!connectionActive(rollup)) return resetGather();
  if (!arrived) {
    rollLanded(uiText("chopLate"), false);
    useHud.getState().setNote(uiText("chopLate"));
    return;
  }
  await pullPack(rollup, program, owner);
  const extra = gained(base, totals());
  const text = extra ? `${uiText("chopBonus")} ${extra}` : uiText("chopMiss");
  rollLanded(text, Boolean(extra));
  useHud.getState().setNote(text);
}

/**
 * Sends one gather and follows it to the end. The caller has already called
 * `beginSwing`, which is what holds a second chop back while this one runs.
 */
export async function chopAndRoll(
  rollup: Connection,
  signer: Keypair,
  owner: PublicKey,
  sessionToken: PublicKey,
  linkEndpoint: string,
  nodeX: number,
  nodeY: number,
  node: number,
): Promise<void> {
  const program = openProgram(rollup);
  const before = totals();
  try {
    await chopTree(rollup, signer, owner, sessionToken, linkEndpoint, nodeX, nodeY, node);
  } catch (err) {
    swingFailed();
    if (!connectionActive(rollup)) return;
    const energy = useHud.getState().energy;
    useHud.getState().setNote(energy !== null && energy < LOW_ENERGY ? uiText("outOfEnergy") : playerMessage(err));
    return;
  }
  try {
    await pullPack(rollup, program, owner);
    if (!connectionActive(rollup)) return resetGather();
    const base = totals();
    const got = gained(before, base) || uiText("chopDone");
    swingLanded(got);
    useHud.getState().setNote(`${got} · ${uiText(auroraNow().up ? "chopRollingAurora" : "chopRolling")}`);
    if (node === 0) tell({ kind: "chopped" });
    await awaitRoll(rollup, program, owner, base);
  } catch (err) {
    // The chop itself landed; only reading its result failed. The cooldown still runs out by itself.
    rollLanded(uiText("chopRolled"), false);
    if (connectionActive(rollup)) useHud.getState().setNote(playerMessage(err));
  }
}
