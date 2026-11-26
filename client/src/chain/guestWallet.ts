import {
  BaseMessageSignerWalletAdapter,
  WalletNotConnectedError,
  WalletReadyState,
  isVersionedTransaction,
  type WalletName,
} from "@solana/wallet-adapter-base";
import {
  type Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  type PublicKey,
  type Transaction,
  type TransactionVersion,
  type VersionedTransaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import { log } from "./log";

export const GUEST_WALLET_NAME = "Guest key (devnet)" as WalletName<"Guest key (devnet)">;

const STORAGE_KEY = "sunhoard.guest";
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'%3E%3Crect width='8' height='8' fill='%231b2233'/%3E%3Crect x='3' y='1' width='2' height='1' fill='%23c9a15a'/%3E%3Crect x='2' y='2' width='4' height='4' fill='%23ffd27a'/%3E%3Crect x='3' y='3' width='2' height='2' fill='%23fff3c4'/%3E%3Crect x='2' y='6' width='4' height='1' fill='%23c9a15a'/%3E%3C/svg%3E";

/**
 * A throwaway devnet key kept in this browser, for a visitor with no wallet
 * extension. It holds devnet SOL only and signs without a popup. The key never
 * leaves the page; clearing site data forgets it.
 */
export class GuestWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = GUEST_WALLET_NAME;
  url = "https://faucet.solana.com";
  icon = ICON;
  supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set<TransactionVersion>(["legacy", 0]);
  private keypair: Keypair | null = null;

  get connecting(): boolean {
    return false;
  }

  get publicKey(): PublicKey | null {
    return this.keypair ? this.keypair.publicKey : null;
  }

  get readyState(): WalletReadyState {
    return WalletReadyState.Loadable;
  }

  async connect(): Promise<void> {
    this.keypair = loadOrCreate();
    this.emit("connect", this.keypair.publicKey);
  }

  async disconnect(): Promise<void> {
    this.keypair = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this.keypair) throw new WalletNotConnectedError();
    if (isVersionedTransaction(transaction)) transaction.sign([this.keypair]);
    else transaction.partialSign(this.keypair);
    return transaction;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.keypair) throw new WalletNotConnectedError();
    return nacl.sign.detached(message, this.keypair.secretKey);
  }
}

const AIRDROP_LAMPORTS = 0.2 * LAMPORTS_PER_SOL;
const AIRDROP_WAIT_MS = 20_000;

/**
 * Asks the public devnet faucet to fund a guest key. The faucet is rate-limited
 * and often says no, so the caller falls back to telling the visitor to fund it.
 */
export async function fundGuest(connection: Connection, key: PublicKey, enough: number, active = () => true): Promise<boolean> {
  try {
    if (!active()) return false;
    await connection.requestAirdrop(key, AIRDROP_LAMPORTS);
  } catch (err) {
    log(`the devnet faucet said no: ${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`);
    return false;
  }
  const deadline = Date.now() + AIRDROP_WAIT_MS;
  while (active() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if ((await connection.getBalance(key)) >= enough) return true;
  }
  return false;
}

function loadOrCreate(): Keypair {
  const stored = read();
  if (stored) return stored;
  const made = Keypair.generate();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(made.secretKey)));
  } catch {
    // A browser that blocks storage still gets a key for this visit.
  }
  return made;
}

function read(): Keypair | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const secret = JSON.parse(raw) as unknown;
    if (!Array.isArray(secret) || secret.length !== 64) return null;
    return Keypair.fromSecretKey(Uint8Array.from(secret as number[]));
  } catch {
    return null;
  }
}
