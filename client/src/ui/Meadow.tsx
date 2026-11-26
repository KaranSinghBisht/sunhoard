import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection } from "@solana/web3.js";
import { useEffect, useRef } from "react";
import type { PublicKey } from "@solana/web3.js";
import { authToken, signWithSecret } from "../chain/auth";
import { TEE_RPC } from "../chain/config";
import { GUEST_WALLET_NAME } from "../chain/guestWallet";
import { rollupEndpoint } from "../chain/explorer";
import { playerMessage } from "../chain/format";
import { enterMeadow, walletSigner } from "../chain/login";
import { ownedPda } from "../chain/pdas";
import { inRange, nextPost, type Pace } from "../chain/pace";
import { chopTree, postMove } from "../chain/play";
import { openProgram } from "../chain/program";
import { createSession, openSigner, type LiveSession } from "../chain/session";
import { setLive } from "../chain/live";
import { armChop, pullAccounts, watchAccounts, watchArena } from "../chain/watch";
import { uiText } from "../content/text";
import { setBridge, type MoveReport } from "../game/bridge";
import { createGame } from "../game/createGame";
import { bindGame } from "../game/stage";
import { useHud } from "./store";

/** What a new wallet needs before sign-up: rent for its accounts, the delegations and the session key. */
const SIGN_UP_LAMPORTS = 80_000_000;

interface Play {
  rollup: Connection;
  session: LiveSession;
  link: string;
  owner: string;
  busy: boolean;
  pace: Pace;
}

/** `gate` is whether the wallet prompt may show over the foot of the canvas. */
export function Meadow({ zoom, gate: gateOpen }: { zoom: number; gate: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const play = useRef<Play | null>(null);
  const { connection } = useConnection();
  const { publicKey, signTransaction, signMessage, select } = useWallet();
  const sessionReady = useHud((state) => state.sessionReady);
  const busy = useHud((state) => state.busy);
  const game = useRef<ReturnType<typeof createGame> | null>(null);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const created = createGame(parent, zoom);
    game.current = created;
    bindGame(created);
    return () => {
      created.destroy(true);
      game.current = null;
      bindGame(null);
    };
  }, []);

  useEffect(() => {
    game.current?.scale.setZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    setBridge({
      move: (report) => {
        if (!publicKey) return;
        void place(play.current, publicKey, report);
      },
      chop: (report) => {
        const current = play.current;
        if (!current || !publicKey) {
          useHud.getState().setNote(uiText("needSession"));
          return;
        }
        void chopAt(current, publicKey, report);
      },
    });
  }, [publicKey]);

  async function enter() {
    if (!publicKey || !signTransaction || !signMessage) return;
    const hud = useHud.getState();
    hud.setBusy(true);
    hud.setNote("");
    try {
      // Sign-up pays rent for six accounts; say so plainly instead of failing at the first transaction.
      const joined = await connection.getAccountInfo(ownedPda("player", publicKey));
      if (!joined && (await connection.getBalance(publicKey)) < SIGN_UP_LAMPORTS) {
        hud.setNote(uiText("needSol"));
        return;
      }
      const wallet = walletSigner(publicKey, signTransaction);
      const signer = openSigner();
      const linkToken = await authToken(signer.signer.publicKey, signWithSecret(signer.signer.secretKey));
      const link = rollupEndpoint(TEE_RPC, linkToken);
      const walletToken = await enterMeadow(connection, publicKey, wallet, signMessage, link);
      const session = await createSession(connection, wallet, publicKey);
      const rollup = new Connection(rollupEndpoint(TEE_RPC, walletToken), "confirmed");
      play.current = {
        rollup,
        session,
        link,
        owner: publicKey.toBase58(),
        busy: false,
        pace: { posted: false, x: 0, y: 0, at: 0 },
      };
      setLive({ rollup, session, link, owner: publicKey });
      const program = openProgram(rollup);
      await pullAccounts(rollup, program, publicKey);
      const stop = watchAccounts(rollup, program, publicKey);
      const stopArena = watchArena(rollup, program, publicKey);
      hud.setSession(true);
      window.addEventListener(
        "pagehide",
        () => {
          void stop();
          void stopArena();
        },
        { once: true },
      );
    } catch (err) {
      hud.setNote(playerMessage(err));
    } finally {
      hud.setBusy(false);
    }
  }

  // The gate sits over the foot of the canvas until a session is live; walking works without one.
  const gate = !publicKey ? (
    <div className="gate">
      <p>{uiText("gate")}</p>
      <WalletMultiButton />
      <button type="button" className="quiet" onClick={() => select(GUEST_WALLET_NAME)}>
        {uiText("guest")}
      </button>
    </div>
  ) : (
    <div className="gate">
      <button type="button" className="begin" onClick={() => void enter()} disabled={busy}>
        {busy ? uiText("entering") : uiText("enter")}
      </button>
    </div>
  );

  return (
    <div className="stage">
      <div ref={host} />
      {gateOpen && !sessionReady ? gate : null}
    </div>
  );
}

async function place(current: Play | null, owner: PublicKey, report: MoveReport): Promise<boolean> {
  if (!current || current.busy) return false;
  current.busy = true;
  try {
    const step = nextPost(current.pace, report.x, report.y, Date.now());
    if (!step) return current.pace.posted;
    await postMove(
      current.rollup,
      current.session.signer,
      owner,
      current.session.token,
      current.link,
      step.x,
      step.y,
      report.facing,
    );
    current.pace = { posted: true, x: step.x, y: step.y, at: Date.now() };
    return true;
  } catch (err) {
    useHud.getState().setNote(playerMessage(err));
    return false;
  } finally {
    current.busy = false;
  }
}

async function chopAt(
  current: Play,
  owner: PublicKey,
  report: { x: number; y: number; nodeX: number; nodeY: number; node?: number },
): Promise<void> {
  const placed = await place(current, owner, { x: report.x, y: report.y, facing: 0 });
  if (!placed) return;
  if (!inRange(current.pace.x, current.pace.y, report.nodeX, report.nodeY)) {
    useHud.getState().setNote(uiText("closer"));
    return;
  }
  armChop();
  useHud.getState().setNote(uiText("chopped"));
  try {
    await chopTree(
      current.rollup,
      current.session.signer,
      owner,
      current.session.token,
      current.link,
      report.nodeX,
      report.nodeY,
      report.node ?? 0,
    );
  } catch (err) {
    useHud.getState().setNote(playerMessage(err));
  }
}
