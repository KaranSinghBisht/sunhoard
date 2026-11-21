import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAP_H, MAP_W } from "../src/game/meadow/layout";
import { meadow } from "../src/game/meadow/props";
import { reaches, routeTo, trail } from "../src/game/meadow/route";
import { BEATS } from "../src/game/story/beats";
import { ARRIVE_X, ARRIVE_Y, EDGE_X, STEPS, advance, type QuestEvent } from "../src/game/story/quest";
import { beginTale, nextBeat, nextLine, skipTale, skipWalk, speak, tell, useTale } from "../src/game/story/tale";

const EVENTS: QuestEvent[] = [
  { kind: "at", x: STEPS[0].stand?.x ?? 0, y: STEPS[0].stand?.y ?? 0 },
  { kind: "chopped" },
  { kind: "talked" },
  { kind: "entered" },
  { kind: "cleared" },
];

describe("the first night", () => {
  it("moves on only when the step's own thing happens", () => {
    for (let step = 0; step < STEPS.length; step += 1) {
      EVENTS.forEach((event, index) => {
        expect(advance(step, event), `${STEPS[step].id} on ${event.kind}`).toBe(index === step ? step + 1 : step);
      });
    }
    expect(advance(0, { kind: "at", x: ARRIVE_X, y: ARRIVE_Y })).toBe(0);
    expect(advance(STEPS.length, { kind: "cleared" })).toBe(STEPS.length);
  });

  it("can be walked: the road in is clear and every trail reaches its goal", () => {
    const { solid } = meadow();
    for (let x = EDGE_X; x <= ARRIVE_X; x += 1) expect(solid.blocks(x, ARRIVE_Y), `road at ${x}`).toBe(false);
    let from = { x: ARRIVE_X, y: ARRIVE_Y };
    for (const step of STEPS) {
      if (!step.stand) continue;
      const route = routeTo(solid, step.stand.x, step.stand.y);
      expect(reaches(route, from.x, from.y), step.id).toBe(true);
      let at = from;
      for (let hops = 0; hops < 400; hops += 1) {
        const [next] = trail(route, at.x, at.y, 1, 8);
        if (!next) break;
        expect(solid.blocks(next.x, next.y), `${step.id} trail at ${next.x},${next.y}`).toBe(false);
        at = next;
      }
      expect(Math.hypot(at.x - step.stand.x, at.y - step.stand.y), `${step.id} trail end`).toBeLessThanOrEqual(16);
      from = at;
    }
  });

  it("puts every marker and every line of the opening on the map", () => {
    for (const spot of [...BEATS, ...STEPS.flatMap((step) => (step.mark ? [step.mark] : []))]) {
      expect(spot.x).toBeGreaterThanOrEqual(0);
      expect(spot.x).toBeLessThanOrEqual(MAP_W);
      expect(spot.y).toBeGreaterThanOrEqual(0);
      expect(spot.y).toBeLessThanOrEqual(MAP_H);
    }
    expect(BEATS.filter((beat) => beat.walkIn)).toHaveLength(1);
    expect(BEATS[BEATS.length - 1].walkIn).toBe(true);
  });
});

describe("the tale", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("plays the opening line by line, ignoring the key press that started it", () => {
    beginTale();
    expect(useTale.getState()).toMatchObject({ beat: 0, step: 0, arrivals: 1 });
    nextBeat();
    expect(useTale.getState().beat).toBe(0);
    for (let beat = 1; beat < BEATS.length; beat += 1) {
      vi.advanceTimersByTime(400);
      nextBeat();
      expect(useTale.getState().beat).toBe(beat);
    }
    vi.advanceTimersByTime(400);
    nextBeat();
    expect(useTale.getState().beat).toBeNull();
  });

  it("holds the walk still until the opening is over, then runs it to the end", () => {
    beginTale();
    tell(EVENTS[0]);
    expect(useTale.getState().step).toBe(0);
    skipTale();
    tell(EVENTS[0]);
    tell(EVENTS[1]);
    expect(useTale.getState().step).toBe(2);
    speak("nellName", "", ["nell1", "nell3"]);
    nextLine();
    expect(useTale.getState().talk?.index).toBe(1);
    nextLine();
    expect(useTale.getState()).toMatchObject({ talk: null, step: 3 });
    tell(EVENTS[3]);
    tell(EVENTS[4]);
    expect(useTale.getState()).toMatchObject({ step: STEPS.length, ended: "done" });
  });

  it("can be skipped", () => {
    beginTale();
    skipTale();
    skipWalk();
    expect(useTale.getState()).toMatchObject({ beat: null, step: STEPS.length, ended: null });
  });
});
