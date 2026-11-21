import { uiText } from "../content/text";
import { nextLine, useTale } from "../game/story/tale";
import { Typed } from "./Typed";

/** Someone in the Vale is speaking: a face, a name and one line at a time. */
export function Talk() {
  const talk = useTale((state) => state.talk);
  if (!talk) return null;
  const last = talk.index + 1 >= talk.lines.length;
  return (
    <section className="talk" onClick={nextLine}>
      <img src={talk.face} alt="" />
      <div>
        <strong>{uiText(talk.who)}</strong>
        <Typed text={uiText(talk.lines[talk.index])} />
      </div>
      <span className="dim">{uiText(last ? "talkEnd" : "taleNext")}</span>
    </section>
  );
}
