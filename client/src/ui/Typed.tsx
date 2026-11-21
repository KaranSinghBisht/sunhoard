import { useTyped } from "./useTyped";

/** A line that types itself out. The untyped rest is laid out but hidden, so the box never changes size. */
export function Typed({ text }: { text: string }) {
  const count = useTyped(text);
  return (
    <p className="typed" aria-label={text}>
      <span aria-hidden="true">{text.slice(0, count)}</span>
      <span className="ghost" aria-hidden="true">
        {text.slice(count)}
      </span>
    </p>
  );
}
