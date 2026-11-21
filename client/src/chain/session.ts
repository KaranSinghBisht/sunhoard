import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { uiText } from "../content/text";
import { SessionTokenManager } from "@magicblock-labs/gum-sdk";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { PROGRAM_ID, SESSION_SECONDS, SESSION_TOP_UP } from "./config";
import { sessionTokenPda } from "./pdas";
import type { SendSigner } from "./send";

const STORAGE_KEY = "sunhoard.session";

interface StoredSession {
  secret: number[];
  expiresAt: number;
}

export interface LiveSession {
  signer: Keypair;
  token: PublicKey;
  expiresAt: number;
}

export function loadSession(sessionProgram: PublicKey, authority: PublicKey): LiveSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const stored = parseStored(raw);
  if (!stored || stored.expiresAt <= Math.floor(Date.now() / 1000)) {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
  const signer = Keypair.fromSecretKey(Uint8Array.from(stored.secret));
  return {
    signer,
    token: sessionTokenPda(sessionProgram, signer.publicKey, authority),
    expiresAt: stored.expiresAt,
  };
}

export function openSigner(): { signer: Keypair; expiresAt: number } {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  const stored = raw ? parseStored(raw) : null;
  if (stored && stored.expiresAt > Math.floor(Date.now() / 1000)) {
    return { signer: Keypair.fromSecretKey(Uint8Array.from(stored.secret)), expiresAt: stored.expiresAt };
  }
  const signer = Keypair.generate();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ secret: Array.from(signer.secretKey), expiresAt }));
  return { signer, expiresAt };
}

export async function createSession(
  connection: Connection,
  wallet: SendSigner,
  authority: PublicKey,
): Promise<LiveSession> {
  const provider = new AnchorProvider(connection, walletAsAnchor(wallet) as never, { commitment: "confirmed" });
  const manager = new SessionTokenManager(provider as never, connection);
  const { signer, expiresAt } = openSigner();
  const sessionProgram = (manager.program as unknown as Program).programId;
  const token = sessionTokenPda(sessionProgram, signer.publicKey, authority);
  const existing = await connection.getAccountInfo(token);
  if (existing) return { signer, token, expiresAt };
  const latest = await connection.getLatestBlockhash();
  const tx = await manager.program.methods
    .createSessionV2(true, new BN(expiresAt), new BN(SESSION_TOP_UP))
    .accounts({
      targetProgram: PROGRAM_ID,
      sessionSigner: signer.publicKey,
      feePayer: authority,
      authority,
    })
    .transaction();
  tx.feePayer = authority;
  tx.recentBlockhash = latest.blockhash;
  tx.partialSign(signer);
  const signed = await wallet.sign(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  const confirmed = await connection.confirmTransaction(
    { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed",
  );
  if (confirmed.value.err) throw new Error(uiText("sessionLost"));
  const account = await connection.getAccountInfo(token);
  if (!account) throw new Error(uiText("sessionLost"));
  return { signer, token, expiresAt };
}

function parseStored(raw: string): StoredSession | null {
  try {
    const value = JSON.parse(raw) as StoredSession;
    if (!Array.isArray(value.secret) || value.secret.length !== 64) return null;
    return value;
  } catch {
    return null;
  }
}

function walletAsAnchor(wallet: SendSigner) {
  return {
    publicKey: wallet.publicKey,
    signTransaction: (tx: Transaction) => wallet.sign(tx),
    signAllTransactions: async (txs: Transaction[]) => {
      const signed = [];
      for (const tx of txs) signed.push(await wallet.sign(tx));
      return signed;
    },
  };
}
