import { uiText } from "../../content/text";
import { shortHex } from "./thawResult";

/** A pixel tick or cross: the game's font has neither glyph. */
function Mark({ ok }: { ok: boolean }) {
  const path = ok ? "M1 6h2v2h2V6h2V4h2V2h2v2H9v2H7v2H5v2H3V8H1z" : "M1 1h2v2h2v2h2V3h2V1h2v2H9v2H7v2h2v2h2v2H9V9H7V7H5v2H3v2H1V9h2V7h2V5H3V3H1z";
  return (
    <svg className="roll-mark" viewBox="0 0 12 12" width="18" height="18" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

interface StampProps {
  /** The commitment the player was shown before paying. */
  seal: Uint8Array;
  /** sha256 of the key the program revealed; null when no key was read. */
  keyHash: Uint8Array | null;
  /** The page's own check that the two are equal. */
  ok: boolean;
  /** The reveal has not happened yet: only the seal is known. */
  waiting: boolean;
  /** The shell held frost dust, whose slot is cleared and keeps no key. */
  dust: boolean;
}

/** The proof, as a stamp: the seal from before the fee beside the hash of the key from after it. */
export function SealStamp({ seal, keyHash, ok, waiting, dust }: StampProps) {
  const tone = waiting ? "wait" : ok ? "ok" : keyHash ? "bad" : "none";
  return (
    <div className={`roll-stamp is-${tone}`}>
      <dl>
        <dt>{uiText("rollStampSeal")}</dt>
        <dd>{shortHex(seal)}</dd>
        <dt>{uiText("rollStampHash")}</dt>
        <dd>{keyHash ? shortHex(keyHash) : waiting ? uiText("rollStampWait") : "-"}</dd>
      </dl>
      {waiting ? null : (
        <p className="roll-verdict" role="status">
          {keyHash ? <Mark ok={ok} /> : null}
          {keyHash ? uiText(ok ? "rollStampOk" : "rollStampBad") : uiText(dust ? "rollStampDust" : "rollStampNone")}
        </p>
      )}
    </div>
  );
}
