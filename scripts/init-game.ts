/**
 * Devnet setup for the shared accounts. The student runs this. It is not a deploy.
 *
 *   cd game/scripts && yarn && cd ..
 *   export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
 *   export ANCHOR_WALLET=$HOME/.config/solana/sunhoard-admin.json
 *   export ER_URL=...   # MagicBlock devnet rollup. Leave unset to stop after delegation.
 *   node --experimental-strip-types scripts/init-game.ts
 *
 * Rollup steps use the queue and VRF program ids from the roll-dice example.
 */
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const PROGRAM_ID = new PublicKey("FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS");
const DELEGATION = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const VALIDATOR = new PublicKey("MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo");
const MAGIC = new PublicKey("Magic11111111111111111111111111111111111111");
const PERMISSION = new PublicKey("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");
const EPHEMERAL_VAULT = new PublicKey("MagicVau1t999999999999999999999999999999999");
const VRF = new PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");
const QUEUE = new PublicKey("5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc");
const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");
const VAULT_LAMPORTS = new BN(100_000_000);

const idl = JSON.parse(readFileSync(new URL("../client/src/gen/idl/sunhoard.json", import.meta.url), "utf8"));

function pda(seeds: Uint8Array[], program = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync(seeds.map((seed) => Buffer.from(seed)), program)[0];
}

function text(value: string): Uint8Array {
  return Buffer.from(value);
}

function trio(account: PublicKey) {
  return {
    buffer: pda([text("buffer"), account.toBytes()]),
    record: pda([text("delegation"), account.toBytes()], DELEGATION),
    metadata: pda([text("delegation-metadata"), account.toBytes()], DELEGATION),
  };
}

function walletFromEnv(): Wallet {
  const path = (process.env.ANCHOR_WALLET ?? `${homedir()}/.config/solana/sunhoard-admin.json`).replace(
    "$HOME",
    homedir(),
  );
  const secret = JSON.parse(readFileSync(path, "utf8")) as number[];
  return new Wallet(Keypair.fromSecretKey(Uint8Array.from(secret)));
}

function providerFor(url: string, wallet: Wallet): AnchorProvider {
  return new AnchorProvider(new Connection(url, "confirmed"), wallet, { commitment: "confirmed" });
}

function budget() {
  return ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
}

async function main() {
  const baseUrl = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
  const wallet = walletFromEnv();
  const base = new Program(idl, providerFor(baseUrl, wallet));
  const admin = wallet.publicKey;
  const season = pda([text("season")]);
  const world = pda([text("world")]);
  const market = pda([text("market")]);
  const prices = pda([text("prices")]);
  const presence = pda([text("presence")]);
  const vault = pda([text("vault")]);
  const payout = pda([text("payout"), Buffer.from(new BN(1).toArray("le", 8))]);
  const escrow = pda([text("balance"), admin.toBytes(), Uint8Array.of(255)], DELEGATION);

  const connection = base.provider.connection;
  if (!(await connection.getAccountInfo(season))) {
  await base.methods
    .initGame(VAULT_LAMPORTS)
    .accounts({
      admin,
      season,
      world,
      market,
      prices,
      presence,
      vault,
      escrow,
      delegationProgram: DELEGATION,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  }
  if (!(await connection.getAccountInfo(payout))) {
    await base.methods.initPayout().accounts({ admin, vault, payout, systemProgram: SystemProgram.programId }).rpc();
  }
  const seasonNow = await connection.getAccountInfo(season);

  if (seasonNow && !seasonNow.owner.equals(DELEGATION)) {
  const seasonDel = trio(season);
  const worldDel = trio(world);
  const marketDel = trio(market);
  const pricesDel = trio(prices);
  const presenceDel = trio(presence);
  await base.methods
    .delegateShared()
    .preInstructions([budget()])
    .accounts({
      admin,
      vault,
      bufferSeason: seasonDel.buffer,
      delegationRecordSeason: seasonDel.record,
      delegationMetadataSeason: seasonDel.metadata,
      season,
      bufferWorld: worldDel.buffer,
      delegationRecordWorld: worldDel.record,
      delegationMetadataWorld: worldDel.metadata,
      world,
      bufferMarket: marketDel.buffer,
      delegationRecordMarket: marketDel.record,
      delegationMetadataMarket: marketDel.metadata,
      market,
      bufferPrices: pricesDel.buffer,
      delegationRecordPrices: pricesDel.record,
      delegationMetadataPrices: pricesDel.metadata,
      prices,
      bufferPresence: presenceDel.buffer,
      delegationRecordPresence: presenceDel.record,
      delegationMetadataPresence: presenceDel.metadata,
      presence,
      validator: VALIDATOR,
      ownerProgram: PROGRAM_ID,
      delegationProgram: DELEGATION,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  }
  console.log("shared accounts created and delegated");

  const rollup = process.env.ER_URL;
  if (!rollup) {
    console.log("ER_URL is unset. Permissions and start_season stay for the rollup call.");
    return;
  }
  const er = new Program(idl, providerFor(rollup, wallet));
  const permission = (account: PublicKey) => pda([text("permission:"), account.toBytes()], PERMISSION);
  await er.methods
    .setPermissionsShared()
    .preInstructions([budget()])
    .accounts({
      admin,
      season,
      seasonPermission: permission(season),
      world,
      worldPermission: permission(world),
      market,
      marketPermission: permission(market),
      prices,
      pricesPermission: permission(prices),
      presence,
      presencePermission: permission(presence),
      permissionProgram: PERMISSION,
      ephemeralVault: EPHEMERAL_VAULT,
      magicProgram: MAGIC,
    })
    .rpc();
  await er.methods
    .startSeason()
    .accounts({
      admin,
      season,
      world,
      oracleQueue: QUEUE,
      programIdentity: pda([text("identity")]),
      vrfProgram: VRF,
      slotHashes: SLOT_HASHES,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("permissions set and the salt requested. The callback opens season 1.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
