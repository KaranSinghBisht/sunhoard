// A practice room for visitors with no session: the same step function the chain
// runs (shared/fight.ts), ticked locally. Nothing here is sent anywhere.
import { cloneFight, openRoom, stepFight, type Fight, type Intent } from "../shared/fight";
import { setChainFight } from "./fightFeed";

const STEP_MS = 100;
/** Steps the finished room stays on screen before a fresh one opens. */
const REST_STEPS = 30;
const STILL: Intent = { dx: 0, dy: 0, attack: false, dash: false };

let timer: ReturnType<typeof setInterval> | undefined;
let intent: Intent = STILL;

function seed(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

function finished(fight: Fight): boolean {
  return fight.player.hp <= 0 || fight.foes.every((foe) => foe.body.hp <= 0);
}

export function startPractice(): void {
  stopPractice();
  let fight: Fight = openRoom(seed(), 1, 100);
  let rest = 0;
  intent = STILL;
  setChainFight(cloneFight(fight), false);
  timer = setInterval(() => {
    rest = finished(fight) ? rest + 1 : 0;
    if (rest > REST_STEPS) {
      fight = openRoom(seed(), 1, 100);
      rest = 0;
    } else {
      stepFight(fight, intent);
    }
    setChainFight(cloneFight(fight), false);
  }, STEP_MS);
}

export function stopPractice(): void {
  if (timer === undefined) return;
  clearInterval(timer);
  timer = undefined;
  setChainFight(null, false);
}

/** The keys held right now; the next local step uses them. */
export function aimPractice(next: Intent): void {
  intent = next;
}

export function practising(): boolean {
  return timer !== undefined;
}
