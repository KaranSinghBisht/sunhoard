/**
 * Admin calls on the devnet rollup. The student runs these; devnet only.
 *
 *   node --experimental-strip-types scripts/admin.ts status
 *   node --experimental-strip-types scripts/admin.ts demo on|off
 *   node --experimental-strip-types scripts/admin.ts schedule
 *   node --experimental-strip-types scripts/admin.ts grant <wallet> gear <kind 12-19> <rarity 0-4>
 *   node --experimental-strip-types scripts/admin.ts grant <wallet> shell <size 1-5>
 *   node --experimental-strip-types scripts/admin.ts settle
 *   node --experimental-strip-types scripts/admin.ts check      # offline: builds every call
 *
 * `schedule` starts the season clock's crank; run it once the season is open.
 * `settle` works only after Old Gloam has fallen; it writes the SOL split.
 */
import { Keypair, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import {
  type Game,
  MAGIC,
  MAGIC_CONTEXT,
  PROGRAM_ID,
  adminKeypair,
  budget,
  offlineGame,
  owned,
  payoutPda,
  rollupGame,
  run,
  say,
  shared,
} from "./lib.ts";

const SEASON_FLAGS = ["demo mode", "killer named", "Ember Egg held", "salt pending"];

interface Grant {
  wallet: PublicKey;
  kind: number;
  rarity: number;
  shell: number;
}

function demoIx(game: Game, admin: PublicKey, on: boolean): Promise<TransactionInstruction> {
  return game.methods.setDemoMode(on ? 1 : 0).accountsPartial({ admin, season: shared().season }).instruction();
}

function scheduleIx(game: Game, admin: PublicKey): Promise<TransactionInstruction> {
  const at = shared();
  return game.methods
    .scheduleWorld()
    .accountsPartial({ admin, season: at.season, world: at.world, prices: at.prices, magicProgram: MAGIC })
    .instruction();
}

function grantIx(game: Game, admin: PublicKey, grant: Grant): Promise<TransactionInstruction> {
  const at = shared();
  return game.methods
    .demoGrant(grant.kind, grant.rarity, grant.shell)
    .accountsPartial({
      admin,
      season: at.season,
      world: at.world,
      player: owned("player", grant.wallet),
      inventory: owned("inventory", grant.wallet),
    })
    .instruction();
}

function settleIx(game: Game, admin: PublicKey, seasonNumber: number): Promise<TransactionInstruction> {
  const at = shared();
  return game.methods
    .settleSeason()
    .accountsPartial({
      admin,
      season: at.season,
      world: at.world,
      payout: payoutPda(seasonNumber),
      vault: at.vault,
      programId: PROGRAM_ID,
      magicProgram: MAGIC,
      magicContext: MAGIC_CONTEXT,
    })
    .instruction();
}

function whole(value: string | undefined, low: number, high: number, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < low || parsed > high) {
    throw new Error(`${name} must be a whole number from ${low} to ${high}`);
  }
  return parsed;
}

/** Reads `grant <wallet> gear <kind> <rarity>` or `grant <wallet> shell <size>`. */
function parseGrant(args: string[]): Grant {
  const [wallet, what, first, second] = args;
  if (!wallet) throw new Error("grant needs a wallet address");
  const to = new PublicKey(wallet);
  if (what === "gear") {
    return { wallet: to, kind: whole(first, 12, 19, "kind"), rarity: whole(second, 0, 4, "rarity"), shell: 0 };
  }
  if (what === "shell") {
    return { wallet: to, kind: 0, rarity: 0, shell: whole(first, 1, 5, "size") };
  }
  throw new Error("grant takes `gear <kind> <rarity>` or `shell <size>`");
}

async function send(game: Game, ix: TransactionInstruction, done: string): Promise<void> {
  if (!game.provider.sendAndConfirm) throw new Error("this provider cannot send");
  const signature = await game.provider.sendAndConfirm(new Transaction().add(budget(), ix));
  say(`${done} (${signature})`);
}

async function status(game: Game): Promise<void> {
  const state = (await game.account.season.fetch(shared().season)) as Record<string, { toString(): string } | number>;
  const flags = Number(state.flags);
  const set = SEASON_FLAGS.filter((_, bit) => (flags & (1 << bit)) !== 0);
  say(`season ${String(state.seasonNumber)} · phase ${String(state.phase)} · players ${String(state.playerCount)}`);
  say(`pot ${String(state.pot)} · burned ${String(state.burned)} (Glint hundredths)`);
  say(`slayers ${String(state.damageLen)} · total damage ${String(state.totalDamage)}`);
  say(`phase ends ${new Date(Number(state.phaseEnds.toString()) * 1000).toISOString()}`);
  say(`flags: ${set.length > 0 ? set.join(", ") : "none"}`);
}

/** Builds every admin call against the IDL without a network or the admin key. */
async function check(): Promise<void> {
  const stand = Keypair.generate();
  const game = offlineGame(stand);
  const who = stand.publicKey;
  const built: Array<[string, TransactionInstruction]> = [
    ["set_demo_mode", await demoIx(game, who, true)],
    ["schedule_world", await scheduleIx(game, who)],
    ["demo_grant gear", await grantIx(game, who, parseGrant([who.toBase58(), "gear", "13", "2"]))],
    ["demo_grant shell", await grantIx(game, who, parseGrant([who.toBase58(), "shell", "3"]))],
    ["settle_season", await settleIx(game, who, 1)],
  ];
  for (const [name, ix] of built) {
    say(`${name}: ${ix.keys.length} accounts, ${ix.data.length} bytes`);
  }
}

type Call = (game: Game, admin: PublicKey) => Promise<void>;

/** Reads the command line into one call. Nothing here touches the key or the network. */
function plan(command: string | undefined, args: string[]): Call {
  if (command === "status") return (game) => status(game);
  if (command === "demo") {
    const on = args[0] === "on";
    if (!on && args[0] !== "off") throw new Error("demo takes on or off");
    return async (game, admin) => send(game, await demoIx(game, admin, on), `demo mode ${on ? "on" : "off"}`);
  }
  if (command === "schedule") {
    return async (game, admin) => send(game, await scheduleIx(game, admin), "the season clock is scheduled");
  }
  if (command === "grant") {
    const grant = parseGrant(args);
    return async (game, admin) => send(game, await grantIx(game, admin, grant), "demo item granted");
  }
  if (command === "settle") {
    return async (game, admin) => {
      const state = (await game.account.season.fetch(shared().season)) as { seasonNumber: number };
      await send(game, await settleIx(game, admin, Number(state.seasonNumber)), "the season is settled");
    };
  }
  throw new Error("usage: admin.ts status | demo on|off | schedule | grant ... | settle | check");
}

run(async () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === "check") return check();
  // The arguments are checked before the admin key is read or the rollup is asked for a token.
  const call = plan(command, args);
  const admin = adminKeypair();
  await call(await rollupGame(admin), admin.publicKey);
});
