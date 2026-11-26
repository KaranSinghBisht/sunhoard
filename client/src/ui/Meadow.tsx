import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection } from "@solana/web3.js";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { PublicKey } from "@solana/web3.js";
import { authExpiry, forgetAuth } from "../chain/auth";
import { TEE_RPC } from "../chain/config";
import { GUEST_WALLET_NAME, fundGuest } from "../chain/guestWallet";
import { rollupEndpoint } from "../chain/explorer";
import { playerMessage } from "../chain/format";
import { enterMeadow, walletSigner } from "../chain/login";
import { ownedPda } from "../chain/pdas";
import { inRange, nextPost, type Pace } from "../chain/pace";
import { chopTree, postMove } from "../chain/play";
import { openProgram } from "../chain/program";
import { createSession, type LiveSession } from "../chain/session";
import { requireCurrent, scopeConnection, connectionActive } from "../chain/ownership";
import { resetPlayer } from "./resetPlayer";
import { tell } from "../game/story/tale";
import { log } from "../chain/log";
import { setLive } from "../chain/live";
import { armChop, pullAccounts, watchAccounts, watchArena } from "../chain/watch";
import { uiText } from "../content/text";
import { setBridge, type MoveReport } from "../game/bridge";
import { createGame } from "../game/createGame";
import { bindGame } from "../game/stage";
import { useHud } from "./store";
import { stopMusic } from "../art/sound";

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
  const { publicKey, signTransaction, signMessage, select, wallet } = useWallet();
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
      stopMusic();
      created.destroy(true);
      game.current = null;
      bindGame(null);
    };
  }, []);

  useEffect(() => {
    game.current?.scale.setZoom(zoom);
  }, [zoom]);

  const close = useRef<() => void>(() => undefined);
  const ownerId = publicKey?.toBase58() ?? "";
  useLayoutEffect(() => {
    const release = () => {
      close.current();
      forgetAuth(ownerId);
      play.current = null;
      resetPlayer();
    };
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [ownerId, connection]);

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
    return () => setBridge({ move: () => undefined, chop: () => undefined });
  }, [publicKey]);

  async function enter() {
    if (!publicKey || !signTransaction || !signMessage || useHud.getState().busy) return;
    close.current();
    let closed = false;
    let expires = Infinity;
    let timer: number | undefined;
    const stops: Array<() => Promise<void>> = [];
    const active = () => !closed && Date.now() < expires;
    const check = () => requireCurrent(active());
    const release = () => {
      closed = true;
      window.clearTimeout(timer);
      for (const stop of stops.splice(0)) void stop().catch(() => log("Listener removal failed"));
      play.current = null;
    };
    close.current = release;
    const hud = useHud.getState();
    hud.setBusy(true);
    hud.setNote("");
    try {
      const joined = await connection.getAccountInfo(ownedPda("player", publicKey));
      if (!joined && (await connection.getBalance(publicKey)) < SIGN_UP_LAMPORTS) {
        check();
        const guest = wallet?.adapter.name === GUEST_WALLET_NAME;
        if (!guest || !(await fundGuest(connection, publicKey, SIGN_UP_LAMPORTS, active))) {
          check();
          hud.setNote(uiText("needSol"));
          return;
        }
      }
      check();
      const signing = walletSigner(publicKey, signTransaction, active);
      const link = "";
      const walletToken = await enterMeadow(connection, publicKey, signing, signMessage, link);
      check();
      const session = await createSession(connection, signing, publicKey);
      check();
      const tokenEnds = authExpiry(ownerId);
      const sessionEnds = session.expiresAt * 1000;
      expires = Number.isFinite(tokenEnds) && tokenEnds > Date.now() ? Math.min(sessionEnds, tokenEnds) : sessionEnds;
      check();
      const rollup = new Connection(rollupEndpoint(TEE_RPC, walletToken), "confirmed");
      scopeConnection(rollup, active);
      const program = openProgram(rollup);
      await pullAccounts(rollup, program, publicKey);
      check();
      stops.push(watchAccounts(rollup, program, publicKey));
      stops.push(await watchArena(rollup, program, publicKey));
      check();
      play.current = { rollup, session, link, owner: ownerId, busy: false, pace: { posted: false, x: 0, y: 0, at: 0 } };
      setLive({ rollup, session, link, owner: publicKey });
      hud.setSession(true);
      timer = window.setTimeout(() => {
        release();
        forgetAuth(ownerId);
        resetPlayer();
        hud.setNote(uiText("sessionLost"));
      }, Math.max(0, expires - Date.now()));
    } catch (err) {
      if (!closed) {
        release();
        resetPlayer(true);
        hud.setNote(playerMessage(err));
      }
    } finally {
      if (close.current === release && !closed) hud.setBusy(false);
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
    if (connectionActive(current.rollup)) useHud.getState().setNote(playerMessage(err));
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
    if (connectionActive(current.rollup)) {
      useHud.getState().setNote(uiText("chopped"));
      if (!report.node) tell({ kind: "chopped" });
    }
  } catch (err) {
    if (connectionActive(current.rollup)) useHud.getState().setNote(playerMessage(err));
  }
}
