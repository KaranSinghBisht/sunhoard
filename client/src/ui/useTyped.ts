import { useEffect, useState } from "react";

const CHAR_MS = 22;

/** How many characters of `text` have been typed out so far; starts again whenever the text changes. */
export function useTyped(text: string): number {
  const [typed, setTyped] = useState({ text, count: 0 });
  const count = typed.text === text ? typed.count : 0;

  useEffect(() => {
    if (count >= text.length) return undefined;
    const timer = window.setTimeout(() => setTyped({ text, count: count + 1 }), CHAR_MS);
    return () => window.clearTimeout(timer);
  }, [text, count]);

  return count;
}
