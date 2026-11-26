/**
 * Devnet setup for the shared accounts. The student runs this after the deploy.
 * It is not a deploy, and it is safe to run twice: every step checks first.
 *
 *   cd game/scripts && yarn && cd ..
 *   node --experimental-strip-types scripts/init-game.ts          # live clock
 *   SUNHOARD_DEMO=1 node --experimental-strip-types scripts/init-game.ts   # demo clock
 *
 * Optional env (see scripts/.env.example): ANCHOR_PROVIDER_URL, ANCHOR_WALLET, ER_URL.
 * Program ids for the queue and VRF come from MagicBlock's roll-dice example.
 */
import { SystemProgram } from "@solana/web3.js";
import {
  BN,
  DELEGATION,
  EPHEMERAL_VAULT,
  type Game,
  MAGIC,
  PERMISSION,
  PROGRAM_ID,
  QUEUE,
  SLOT_HASHES,
  VALIDATOR,
  VRF,
  adminKeypair,
  baseGame,
  budget,
  payoutPda,
  pda,
  permissionPda,
  rollupGame,
  run,
  say,
  shared,
  text,
  trio,
} from "./lib.ts";

/** The SOL the admin puts in the prize vault: 0.1 SOL of devnet money. */
const VAULT_LAMPORTS = new BN(100_000_000);

type Shared = ReturnType<typeof shared>;

async function createShared(base: Game, admin: ReturnType<typeof adminKeypair>, at: Shared): Promise<void> {
  const connection = base.provider.connection;
  if (await connection.getAccountInfo(at.season)) {
    say("shared accounts already exist");
  } else {
    const escrow = pda([text("balance"), admin.publicKey.toBytes(), Uint8Array.of(255)], DELEGATION);
    await base.methods
      .initGame(VAULT_LAMPORTS)
      .accountsPartial({
        admin: admin.publicKey,
        season: at.season,
        world: at.world,
        market: at.market,
        prices: at.prices,
        presence: at.presence,
        vault: at.vault,
        escrow,
        delegationProgram: DELEGATION,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    say("shared accounts created");
  }
  const payout = payoutPda(1);
  if (await connection.getAccountInfo(payout)) return;
  await base.methods
    .initPayout()
    .accountsPartial({ admin: admin.publicKey, vault: at.vault, payout, systemProgram: SystemProgram.programId })
    .rpc();
  say("payout table created for season 1");
}

async function delegateShared(base: Game, admin: ReturnType<typeof adminKeypair>, at: Shared): Promise<void> {
  const info = await base.provider.connection.getAccountInfo(at.season);
  if (!info) throw new Error("the season account is missing after init_game");
  if (info.owner.equals(DELEGATION)) {
    say("shared accounts already delegated");
    return;
  }
  const [season, world, market, prices, presence] = [at.season, at.world, at.market, at.prices, at.presence].map(trio);
  await base.methods
    .delegateShared()
    .preInstructions([budget()])
    .accountsPartial({
      admin: admin.publicKey,
      vault: at.vault,
      bufferSeason: season.buffer,
      delegationRecordSeason: season.record,
      delegationMetadataSeason: season.metadata,
      season: at.season,
      bufferWorld: world.buffer,
      delegationRecordWorld: world.record,
      delegationMetadataWorld: world.metadata,
      world: at.world,
      bufferMarket: market.buffer,
      delegationRecordMarket: market.record,
      delegationMetadataMarket: market.metadata,
      market: at.market,
      bufferPrices: prices.buffer,
      delegationRecordPrices: prices.record,
      delegationMetadataPrices: prices.metadata,
      prices: at.prices,
      bufferPresence: presence.buffer,
      delegationRecordPresence: presence.record,
      delegationMetadataPresence: presence.metadata,
      presence: at.presence,
      validator: VALIDATOR,
      ownerProgram: PROGRAM_ID,
      delegationProgram: DELEGATION,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  say("shared accounts delegated to the rollup");
}

async function setPermissions(er: Game, admin: ReturnType<typeof adminKeypair>, at: Shared): Promise<void> {
  if (await er.provider.connection.getAccountInfo(permissionPda(at.season))) {
    say("permissions already set");
    return;
  }
  await er.methods
    .setPermissionsShared()
    .preInstructions([budget()])
    .accountsPartial({
      admin: admin.publicKey,
      season: at.season,
      seasonPermission: permissionPda(at.season),
      world: at.world,
      worldPermission: permissionPda(at.world),
      market: at.market,
      marketPermission: permissionPda(at.market),
      prices: at.prices,
      pricesPermission: permissionPda(at.prices),
      presence: at.presence,
      presencePermission: permissionPda(at.presence),
      permissionProgram: PERMISSION,
      ephemeralVault: EPHEMERAL_VAULT,
      magicProgram: MAGIC,
    })
    .rpc();
  say("permissions set");
}

/** Demo mode must be chosen before the season opens: the clock reads it at the start. */
async function openSeason(er: Game, admin: ReturnType<typeof adminKeypair>, at: Shared): Promise<void> {
  const state = (await er.account.season.fetch(at.season)) as { seasonNumber: { toString(): string } };
  if (state.seasonNumber.toString() !== "0") {
    say(`season ${state.seasonNumber.toString()} is already open; start_season skipped`);
    return;
  }
  if (process.env.SUNHOARD_DEMO === "1") {
    await er.methods.setDemoMode(1).accountsPartial({ admin: admin.publicKey, season: at.season }).rpc();
    say("demo mode on: short phases and labelled demo grants");
  }
  await er.methods
    .startSeason()
    .accountsPartial({
      admin: admin.publicKey,
      season: at.season,
      payout: payoutPda(1),
      world: at.world,
      oracleQueue: QUEUE,
      programIdentity: at.identity,
      vrfProgram: VRF,
      slotHashes: SLOT_HASHES,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  say("the salt is requested; its callback opens season 1");
  say("next: node --experimental-strip-types scripts/admin.ts schedule");
}

run(async () => {
  const admin = adminKeypair();
  const at = shared();
  const base = baseGame(admin);
  await createShared(base, admin, at);
  await delegateShared(base, admin, at);
  const er = await rollupGame(admin);
  await setPermissions(er, admin, at);
  await openSeason(er, admin, at);
});
