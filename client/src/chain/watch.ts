import type { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { uiText } from "../content/text";
import { setChainFight } from "../game/fightFeed";
import { setChainLair } from "../game/lairFeed";
import { useAnvil } from "../ui/anvil";
import { useMarket, type ListingView } from "../ui/market";
import { usePack, type SlotView } from "../ui/pack";
import { useShells, type ShellView } from "../ui/shells";
import { useHud } from "../ui/store";
import { useVillage } from "../ui/village";
import { useWorld, type PresenceView, type SlayerView } from "../ui/world";
import { connectionActive } from "./ownership";
import { showScene, useStage } from "../game/stage";
import { arenaPhase } from "./arenaView";
import { asBytes, asNumber, field } from "./bytes";
import { log } from "./log";
import { ownedPda, sharedPda } from "./pdas";

/** Season flag: demo mode, killing blow, Ember Egg. */
const SEASON_DEMO_MODE = 1 << 0;
const SEASON_HAS_KILLER = 1 << 1;
const SEASON_HAS_EMBER = 1 << 2;

/** Reads the pack alone, for the moments a chop needs it fresher than the subscription. */
export async function pullPack(connection: Connection, program: Program, owner: PublicKey): Promise<void> {
  await readAccount(connection, program, ownedPda("inventory", owner), readPack);
}

/** `GATHER_PENDING` in state/bits.rs: a gather's VRF roll has not come back yet. */
const GATHER_PENDING = 1 << 0;

/** True while the last gather's roll is still out; null when the player account cannot be read. */
export async function gatherPending(connection: Connection, program: Program, owner: PublicKey): Promise<boolean | null> {
  const info = await connection.getAccountInfo(ownedPda("player", owner));
  if (!info) return null;
  const player = decode(program, "Player", info.data);
  const flags = asNumber(player?.gatherFlags ?? player?.gather_flags);
  return flags === null ? null : (flags & GATHER_PENDING) !== 0;
}

type Stop = () => Promise<void>;

export async function pullAccounts(connection: Connection, program: Program, owner: PublicKey): Promise<void> {
  await readAccount(connection, program, ownedPda("player", owner), readPlayer);
  await readAccount(connection, program, ownedPda("purse", owner), readPurse);
  await readAccount(connection, program, ownedPda("inventory", owner), readPack);
  await readAccount(connection, program, ownedPda("village", owner), readVillage);
  await readAccount(connection, program, sharedPda("season"), readSeason);
  await readAccount(connection, program, sharedPda("market"), readMarket);
  await readAccount(connection, program, sharedPda("prices"), readPrices);
  await readAccount(connection, program, sharedPda("presence"), readPresence);
}

async function readAccount(
  connection: Connection,
  program: Program,
  account: PublicKey,
  read: (program: Program, data: Buffer) => void,
): Promise<void> {
  const info = await connection.getAccountInfo(account);
  if (info && connectionActive(connection)) read(program, info.data);
}

export function watchAccounts(connection: Connection, program: Program, owner: PublicKey): Stop {
  const ids = [
    connection.onAccountChange(ownedPda("player", owner), (info) => connectionActive(connection) && readPlayer(program, info.data)),
    connection.onAccountChange(ownedPda("purse", owner), (info) => connectionActive(connection) && readPurse(program, info.data)),
    connection.onAccountChange(ownedPda("inventory", owner), (info) => connectionActive(connection) && readPack(program, info.data)),
    connection.onAccountChange(ownedPda("village", owner), (info) => connectionActive(connection) && readVillage(program, info.data)),
    connection.onAccountChange(sharedPda("season"), (info) => connectionActive(connection) && readSeason(program, info.data)),
    connection.onAccountChange(sharedPda("market"), (info) => connectionActive(connection) && readMarket(program, info.data)),
    connection.onAccountChange(sharedPda("prices"), (info) => connectionActive(connection) && readPrices(program, info.data)),
    connection.onAccountChange(sharedPda("presence"), (info) => connectionActive(connection) && readPresence(program, info.data)),
  ];
  return async () => {
    await Promise.all(ids.map(id => connection.removeAccountChangeListener(id)));
  };
}

function readPlayer(program: Program, data: Buffer): void {
  const player = decode(program, "Player", data);
  const energy = asNumber(player?.energy);
  if (energy !== null) useHud.getState().setHud({ energy });
  const equipped = asNumber(player?.equippedSlot ?? player?.equipped_slot);
  usePack.getState().setPack(usePack.getState().slots, equipped === 255 ? null : equipped ?? null);
  const heat = player?.heat;
  if (Array.isArray(heat)) {
    useAnvil.getState().setHeat(heat.map((value) => asNumber(value) ?? 0), asNumber(player?.heatAt ?? player?.heat_at) ?? 0);
  }
}

function readMarket(program: Program, data: Buffer): void {
  const market = decode(program, "Market", data);
  const listings = market?.listings;
  if (!Array.isArray(listings)) {
    useMarket.getState().setListings([]);
    return;
  }
  const out: ListingView[] = [];
  listings.forEach((listing, index) => {
    if (!listing || typeof listing !== "object") return;
    const record = listing as Record<string, unknown>;
    const item = (field(record, "item") ?? {}) as Record<string, unknown>;
    const id = asNumber(field(item, "id")) ?? 0;
    const kind = asNumber(field(item, "kind")) ?? 0;
    const quantity = asNumber(field(item, "quantity")) ?? 0;
    const flags = asNumber(field(item, "flags")) ?? 0;
    if (id === 0 && kind === 0 && quantity === 0 && flags === 0) return;
    out.push({
      id: index,
      seller: String(field(record, "seller")),
      price: String(asBigint(field(record, "price")) ?? 0n),
      revision: String(asBigint(field(record, "revision", "listedAt", "listed_at")) ?? 0n),
      traits: traitsOf(field(item, "traits")),
      expiresAt: asNumber(field(record, "expiresAt", "expires_at")) ?? 0,
      kind,
      quantity,
      rarity: asNumber(field(item, "rarity")) ?? 0,
      tone: asNumber(field(item, "tone")) ?? 0,
      grade: asNumber(field(item, "grade")) ?? 0,
      purityBp: asNumber(field(item, "purityBp", "purity_bp")) ?? 0,
      shell: asNumber(field(item, "shellSize", "shell_size")) ?? 0,
      flags,
    });
  });
  useMarket.getState().setListings(out);
}

function readVillage(program: Program, data: Buffer): void {
  const village = decode(program, "Village", data);
  const postsRaw = village?.posts;
  const villagersRaw = village?.villagers;
  const posts = Array.isArray(postsRaw)
    ? postsRaw.map((post, index) => {
        const record = (post ?? {}) as Record<string, unknown>;
        const flags = asNumber(field(record, "flags")) ?? 0;
        return {
          index,
          built: (flags & 1) !== 0,
          hasBlock: (flags & 2) !== 0,
          tone: asNumber(field(record, "tone")) ?? 0,
          grade: asNumber(field(record, "grade")) ?? 0,
          purityBp: asNumber(field(record, "purityBp", "purity_bp")) ?? 0,
          pattern: asNumber(field(record, "pattern")) ?? 0,
        };
      })
    : [];
  const villagers = Array.isArray(villagersRaw)
    ? villagersRaw
        .map((villager, index) => {
          const record = (villager ?? {}) as Record<string, unknown>;
          const id = asNumber(field(record, "id")) ?? 0;
          const flags = asNumber(field(record, "flags")) ?? 0;
          return {
            index,
            id: String(id),
            profession: asNumber(field(record, "profession")) ?? 0,
            joined: id !== 0,
            wanderer: (flags & 64) !== 0,
            bound: (flags & 32) !== 0,
          };
        })
        .filter((villager) => villager.joined)
    : [];
  useVillage.getState().setVillage({
    warmth: asNumber(village?.warmthX100 ?? village?.warmth_x100) ?? 0,
    beds: asNumber(village?.beds) ?? 0,
    workstations: Array.isArray(village?.workstations)
      ? (village.workstations as unknown[]).filter((station) => (asNumber(station) ?? 0) !== 0).length
      : 0,
    bellUntil: asNumber(village?.bellUntil ?? village?.bell_until) ?? 0,
    bellBusy: ((asNumber(village?.bellFlags ?? village?.bell_flags) ?? 0) & 1) !== 0,
    posts,
    villagers,
  });
}

function readPurse(program: Program, data: Buffer): void {
  const purse = decode(program, "Purse", data);
  const glints = asBigint(purse?.glints);
  if (glints !== null) useHud.getState().setHud({ glints });
}

function readSeason(program: Program, data: Buffer): void {
  const season = decode(program, "Season", data);
  if (!season) return;
  const pot = asBigint(season.pot);
  if (pot !== null) useHud.getState().setHud({ pot });
  const flags = asNumber(season.flags) ?? 0;
  const sunFree = (flags & SEASON_HAS_KILLER) !== 0;
  if (sunFree && !useHud.getState().sunFree) useHud.getState().setNote(uiText("sunFree"));
  useHud.getState().setHud({ sunFree });

  const damageLen = asNumber(field(season, "damageLen", "damage_len")) ?? 0;
  const damageRaw = field(season, "damage");
  const slayers: SlayerView[] = Array.isArray(damageRaw)
    ? damageRaw.slice(0, damageLen).map((row) => {
        const record = (row ?? {}) as Record<string, unknown>;
        const rowFlags = asNumber(field(record, "flags")) ?? 0;
        return {
          wallet: String(field(record, "wallet") ?? ""),
          damage: asBigint(field(record, "damage")) ?? 0n,
          clearedT1: (rowFlags & 1) !== 0,
          isKiller: (rowFlags & 2) !== 0,
          // After awards freeze, the old age word contains the exact Glint entitlement.
          glintAward: flags & 128 ? asBigint(field(record, "ageSecs", "age_secs")) ?? 0n : 0n,
          glintsClaimed: (rowFlags & 4) !== 0,
        };
      })
    : [];
  const rawName = asBytes(field(season, "wyrmName", "wyrm_name"));
  const wyrmName = rawName ? Buffer.from(rawName).toString("utf8").replace(/\0+$/g, "").trim() : "";

  useWorld.getState().setSeason({
    seasonNumber: asNumber(field(season, "seasonNumber", "season_number")) ?? 0,
    phase: asNumber(field(season, "phase")) ?? 0,
    phaseStarted: asNumber(field(season, "phaseStarted", "phase_started")) ?? 0,
    phaseEnds: asNumber(field(season, "phaseEnds", "phase_ends")) ?? 0,
    burned: asBigint(field(season, "burned")) ?? 0n,
    totalDamage: asBigint(field(season, "totalDamage", "total_damage")) ?? 0n,
    killer: String(field(season, "killer") ?? ""),
    emberHolder: String(field(season, "emberHolder", "ember_holder") ?? ""),
    wyrmName,
    sealedLegendaries: asNumber(field(season, "sealedLegendaries", "sealed_legendaries")) ?? 0,
    playerCount: asNumber(field(season, "playerCount", "player_count")) ?? 0,
    demoMode: (flags & SEASON_DEMO_MODE) !== 0,
    hasEmber: (flags & SEASON_HAS_EMBER) !== 0,
    slayers,
  });
}

function readPrices(program: Program, data: Buffer): void {
  const prices = decode(program, "PriceBoard", data);
  if (!prices) return;
  const goodA = asNumber(field(prices, "goodA", "good_a")) ?? 0;
  const goodB = asNumber(field(prices, "goodB", "good_b")) ?? 0;
  const until = asNumber(field(prices, "until")) ?? 0;
  useWorld.getState().setSeason({ lastTick: asNumber(field(prices, "lastRotation", "last_rotation")) ?? 0 });
  const rawBounties = field(prices, "bountyKind", "bounty_kind");
  const bounties = Array.isArray(rawBounties)
    ? rawBounties.map((entry) => asNumber(entry) ?? 0).filter((entry) => entry > 0)
    : [];
  useWorld.getState().setPrices(goodA, goodB, until, bounties);
}

function readPresence(program: Program, data: Buffer): void {
  const presence = decode(program, "Presence", data);
  if (!presence) return;
  const count = asNumber(field(presence, "count")) ?? 0;
  const rows = field(presence, "rows");
  if (!Array.isArray(rows)) return;
  const out: PresenceView[] = rows.slice(0, count).map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    return {
      player: String(field(record, "player") ?? ""),
      x: asNumber(field(record, "x")) ?? 0,
      y: asNumber(field(record, "y")) ?? 0,
      zone: asNumber(field(record, "zone")) ?? 0,
      facing: asNumber(field(record, "facing")) ?? 0,
      updated: asNumber(field(record, "updated")) ?? 0,
    };
  });
  useWorld.getState().setPresence(out);
}

export function readPack(program: Program, data: Buffer): number | null {
  const inventory = decode(program, "Inventory", data);
  const stacks = asNumber(inventory?.count);
  if (stacks !== null) useHud.getState().setHud({ stacks });
  const wood = woodQuantity(inventory);
  useShells.getState().setShells(shellsOf(inventory));
  usePack.getState().setPack(packOf(inventory), usePack.getState().equipped);
  return wood;
}

function packOf(inventory: Record<string, unknown> | null): SlotView[] {
  const slots = inventory?.slots;
  if (!Array.isArray(slots)) return [];
  const out: SlotView[] = [];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (!slot || typeof slot !== "object") continue;
    const record = slot as Record<string, unknown>;
    const id = asBigint(field(record, "id")) ?? 0n;
    const kind = asNumber(field(record, "kind")) ?? 0;
    const quantity = asNumber(field(record, "quantity")) ?? 0;
    const flags = asNumber(field(record, "flags")) ?? 0;
    if ((flags & 16) !== 0 || (id === 0n && kind === 0 && quantity === 0 && flags === 0)) continue;
    out.push({
      slot: index,
      id: String(id),
      kind,
      quantity,
      rarity: asNumber(field(record, "rarity")) ?? 0,
      traits: traitsOf(field(record, "traits")),
      tone: asNumber(field(record, "tone")) ?? 0,
      grade: asNumber(field(record, "grade")) ?? 0,
      purityBp: asNumber(field(record, "purityBp", "purity_bp")) ?? 0,
      pattern: asNumber(field(record, "pattern")) ?? 0,
      shell: asNumber(field(record, "shellSize", "shell_size")) ?? 0,
      flags,
    });
  }
  return out;
}

function traitsOf(value: unknown): Array<{ id: number; tier: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((pair) => pair && typeof pair === "object")
    .map((pair) => {
      const record = pair as Record<string, unknown>;
      const id = asNumber(field(record, "id")) ?? 0;
      const tier = asNumber(field(record, "tier")) ?? 0;
      return { id, tier };
    })
    .filter((pair) => pair.id !== 0);
}

let pullArena: (() => Promise<void>) | null = null;

/**
 * Reads the arena once, now. The scene follows the arena account, and a
 * websocket message can be late or lost, so every confirmed enter, leave and
 * next room asks for it directly as well.
 */
export async function refreshArena(): Promise<void> {
  if (pullArena) await pullArena();
}

export async function watchArena(connection: Connection, program: Program, owner: PublicKey): Promise<Stop> {
  const account = ownedPda("arena", owner);
  let latest = -1;
  const apply = (slot: number, data: Buffer) => {
    if (slot < latest || !connectionActive(connection)) return;
    latest = slot;
    const phase = arenaPhase(program, data);
    if (!phase.scene) throw new Error(uiText("arenaUnreadable"));
    setChainFight(phase.fight, phase.waiting && phase.scene === "cellar");
    setChainLair(phase.lair, phase.waiting && phase.scene === "lair");
    if (useStage.getState().scene !== phase.scene) showScene(phase.scene);
  };
  const id = connection.onAccountChange(account, (info, ctx) => {
    try {
      apply(ctx.slot, info.data);
    } catch (err) {
      log(`arena update unreadable: ${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`);
      useHud.getState().setNote(uiText("arenaUnreadable"));
    }
  });
  const read = async () => {
    const now = await connection.getAccountInfoAndContext(account);
    if (now.value) apply(now.context.slot, now.value.data);
  };
  pullArena = read;
  const stop = async () => {
    if (pullArena === read) pullArena = null;
    await connection.removeAccountChangeListener(id);
  };
  try {
    await read();
    return stop;
  } catch (error) {
    await stop();
    throw error;
  }
}

function shellsOf(inventory: Record<string, unknown> | null): ShellView[] {
  const slots = inventory?.slots;
  if (!Array.isArray(slots)) return [];
  const shells: ShellView[] = [];
  slots.forEach((slot, index) => {
    if (!slot || typeof slot !== "object") return;
    const record = slot as Record<string, unknown>;
    const flags = asNumber(field(record, "flags")) ?? 0;
    if ((flags & 3) === 0) return;
    shells.push({
      slot: index,
      flags,
      commitment: asBytes(field(record, "commitment")) ?? new Uint8Array(),
      key: asBytes(field(record, "revealedKey", "revealed_key")) ?? new Uint8Array(),
      size: asNumber(field(record, "shellSize", "shell_size")) ?? 0,
    });
  });
  return shells;
}

function woodQuantity(inventory: Record<string, unknown> | null): number | null {
  const slots = inventory?.slots;
  if (!Array.isArray(slots)) return null;
  let total = 0;
  for (const slot of slots) {
    if (!slot || typeof slot !== "object") continue;
    const kind = asNumber((slot as { kind?: unknown }).kind);
    const quantity = asNumber((slot as { quantity?: unknown }).quantity);
    if (kind === 1 && quantity) total += quantity;
  }
  return total;
}

/**
 * The revealed thaw key at one pack slot, or null when the slot has none.
 * Used by the Thawery to prove sha256(key) == commitment after a reveal.
 */
export function revealedKeyAt(program: Program, data: Buffer, slot: number): Uint8Array | null {
  const inventory = decode(program, "Inventory", data);
  const slots = inventory?.slots;
  if (!Array.isArray(slots) || slot < 0 || slot >= slots.length) return null;
  const record = slots[slot];
  if (!record || typeof record !== "object") return null;
  const key = asBytes(field(record as Record<string, unknown>, "revealedKey", "revealed_key"));
  if (!key || key.every((byte) => byte === 0)) return null;
  return key;
}

/** Anchor's client names accounts in camelCase ("priceBoard"), whatever the IDL spells. */
function decode(program: Program, name: string, data: Buffer): Record<string, unknown> | null {
  const camel = name.charAt(0).toLowerCase() + name.slice(1);
  try {
    return program.coder.accounts.decode(camel, data) as Record<string, unknown>;
  } catch (err) {
    log(`could not read ${name}: ${err instanceof Error ? err.message.slice(0, 80) : "unknown"}`);
    return null;
  }
}

function asBigint(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (value && typeof value === "object" && "toString" in value) {
    try {
      return BigInt(String(value));
    } catch {
      return null;
    }
  }
  return null;
}
