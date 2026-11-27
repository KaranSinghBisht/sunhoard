import { useEffect, useState } from "react";

/** True when the player asked the system for less motion: reveals then show their result at once. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Walks a reveal through its stages: step 0, then one step on after each wait, ending at
 * `waits.length`. A new `run` starts over; null holds at 0. With reduced motion it is at the end at once.
 */
export function useSteps(run: string | number | null, waits: number[]): number {
  const last = waits.length;
  const [at, setAt] = useState({ run, step: 0 });
  const step = at.run === run ? at.step : 0;

  useEffect(() => {
    if (run === null) return undefined;
    if (reducedMotion()) {
      setAt({ run, step: last });
      return undefined;
    }
    if (step >= last) return undefined;
    const timer = window.setTimeout(() => setAt({ run, step: step + 1 }), waits[step]);
    return () => window.clearTimeout(timer);
    // `waits` is rebuilt every render; its length and the step are what matter.
  }, [run, step, last]);

  return run === null ? 0 : step;
}
