# Sunhoard

A 2D pixel RPG that runs on MagicBlock's Ephemeral Rollups. Chop, mine and fight with no wallet popup, thaw sealed
loot that was fixed the moment it dropped, trade it at a player market whose fee feeds the dragon's hoard, then climb
to the Noonless Crater and split the pot when Old Gloam falls.

**Devnet only.** Nothing here uses real money.

- Program: `FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS` (Solana devnet)
- Season clock: demo mode (a 10-minute Long Night), so the whole arc can be seen in one sitting
- Built for Solana Blitz v10, theme **Entertainment Finance**

## The story

Forty winters ago the dragon Old Gloam swallowed the sun. The light it spilled froze into **Magic Blocks**, sealed in
rimeshells under the frost. You are the new Keeper. Light the meadow, thaw what the frost sealed, take in cold
wanderers, trade at the Coldfair, and finally climb the Rime Stair to the Crater. When the wyrm dies the Sunhoard
opens, and every slayer claims a share of the SOL in the vault.

## Why MagicBlock

| What the game does | What runs it | Why it cannot be plain Solana |
|---|---|---|
| Every chop, swing, step, thaw and listing | Private Ephemeral Rollup, signed by a 12-hour session key | ~10 ms blocks, zero fees, no popup per action |
| Sealed rimeshells, quirks, private purses, Old Gloam's HP | Private ER accounts with per-account permissions | Account data is public on Solana; sealed loot would need a trusted server |
| Every drop, block, trait, villager and defuse | VRF, requested on the rollup | Fairness is verifiable, and even the developer cannot re-roll |
| Dungeon monsters at 10 Hz, the season clock, Pell's Wants | Cranks scheduled on the rollup | No game server to run or trust |
| The kill and the split | A Magic Action chained to the commit | The damage table and the payout record are written in one atomic step |
| The prize vault and the claim | Solana, never delegated | Custody stays on the base layer |

```mermaid
flowchart LR
  subgraph Browser
    P[Phaser 3<br/>480x270 pixel canvas]
    R[React panels<br/>pack, market, thaw, barn]
    S[Session key<br/>12 h, in memory]
  end

  subgraph PER["Private Ephemeral Rollup (TEE validator)"]
    A[Player, Purse, Inventory<br/>Village, Arena, View]
    G[Season, World, Market<br/>PriceBoard, Presence]
    V[VRF oracle]
    C[Cranks<br/>100 ms fight, season clock]
  end

  subgraph Solana["Solana devnet"]
    W[Vault PDA<br/>prize SOL]
    O[Payout record<br/>70 / 20 / 10, 40% cap]
    X[Magic Action<br/>record_payout]
  end

  P --> S --> A
  R --> S
  S --> G
  S --> V
  C --> G
  G -- commit + Magic Action --> X --> O
  O -- claim --> W --> Browser
```

**Privacy is load-bearing, not decoration.** `World` holds the season salt and Old Gloam's HP and has no permission
members, so no wallet can read it. Each player's `Purse` and `View` are readable only by their owner. The Glare is
computed inside the enclave: it compares private purses and reveals only the pick.

**Sealing is two-step.** `crack` charges the fee and marks the shell; `crack_reveal`, in a later slot, recomputes
`key = sha256(salt, item id)`, checks `sha256(key) == commitment`, and writes the key and the gem into the slot. An
owner cannot simulate the reveal and sell only the duds, and anyone can verify a revealed block afterwards.

## Play it

1. Open the client (see below) and connect a devnet wallet.
2. **Enter the meadow** once. This signs up, delegates the six player accounts to the rollup, joins the season and
   creates a session key: about six popups, the last one for an hour of play.
3. Walk with WASD, **Space** to chop, mine, pick or talk, **E** for the pack.
4. Follow the first-night trail: the camp fire, the birch, Nell, the cellar hatch. Clear the Bramble Cellars, take the
   chest, thaw the shell at the Thawery and check the hash.
5. Sell, craft, equip, list at the Coldfair, strike the anvil, set a block in a lantern post.
6. When you are ready, enter the **Noonless Crater**. Old Gloam has one HP pool for the whole season. When it dies the
   Magic Action writes the split on Solana and the claim button pays your share from the vault.

No wallet? The Bramble Cellars button opens a **practice room** that runs the same fixed-step fight in the page. It
sends nothing and awards nothing, so a judge can feel the combat without a key.

## The demo (3 minutes)

| Time | Beat |
|---|---|
| 0:00 | The title over the live, snowbound meadow; the Sunhoard counter |
| 0:15 | Chop and mine with the rollup feed open; the aurora rises |
| 0:40 | Bramble Cellars: crank-ticked monsters, the Snuffer, the boss chest |
| 1:05 | Thaw a sealed rimeshell; the page recomputes the commitment hash |
| 1:25 | List it; a second wallet buys; 5% rises to the Sunhoard, half burns |
| 1:45 | The anvil: 62%, a crack, +5 heat, then the clean strike |
| 2:00 | Lantern posts light the barn; the Hearth Bell rings a wanderer in |
| 2:15 | The Crater; the Glare picks the warmer of two private purses |
| 2:40 | The kill: Noon Unbound, spring sweeps the map, Magic Action, both claims |
| 2:55 | The barn glowing with blocks, and what runs where |

Rare beats (a purple chest, a Legendary block) use the labelled **demo mode** odds and an admin `demo_grant`. The video
says so on screen. Played honestly, a Blazing block from a Small shell is far too rare to catch on camera.

## Run the client

Requires Node 24 and Yarn 1.

```sh
cd client
corepack yarn
corepack yarn dev
```

Open `http://127.0.0.1:5173/`. Copy `.env.example` to `.env.local` first if the program or endpoint changed; the
committed example points at devnet and the TEE validator.

## Build and test

```sh
# program
anchor build
cargo +1.89.0 test --lib                                   # 66 rules tests
cargo +1.93.0 test --manifest-path tests-magicsvm-rs/Cargo.toml   # 4 end-to-end flows

# client
cd client
corepack yarn typecheck
corepack yarn test                                          # 38 tests
```

The MagicSVM flows run the real program binary against an in-process Solana + rollup. They cover:

- `m1`: sign-up, delegation, join, session, gather + VRF callback, the two-step thaw, a cranked room, the Magic Action
  payout and a claim
- `l1`: the loop, six rooms, the Snuffer, the chest, crafting, Pell, eating and equipping
- `l2`: the market with the fee split, the anvil, the Glare, the Crater and a visit
- `l3`: a real kill, the Ember Egg, the season's Spring, naming the next wyrm, `settle_season`, and every share paid

## Devnet setup (the operator)

The admin keypair and all env files are gitignored. The admin key lives outside the repo, at
`~/.config/solana/sunhoard-admin.json`.

```sh
# 1. deploy (devnet only; needs ~16 SOL free while the deploy buffer exists)
./scripts/deploy-devnet.sh

# 2. create the shared accounts, delegate them, set permissions, open season 1 in demo mode
node --experimental-strip-types scripts/init-game.ts

# 3. start the season clock's crank
node --experimental-strip-types scripts/admin.ts schedule
node --experimental-strip-types scripts/admin.ts status
```

`scripts/admin.ts` also has `demo on|off`, `grant <wallet> gear <kind> <rarity>`, `grant <wallet> shell <size>` and
`settle`. Everything is devnet-guarded and nothing prints a key or a token.

## Layout

```
programs/sunhoard/src/
  instructions/   one folder per feature: player, gather, craft, market, anvil, dungeon, lair, village, season
  logic/          pure Rust rules: the seal, gather, VRF rolls, the fixed-step fights, prices, the split
  state/          the 13 accounts, zero-copy, every one under 10 KB
tests-magicsvm-rs/  the four end-to-end flows
client/src/
  chain/          connections, TEE token, session key, tx queue, TxLog, program clients
  game/           Phaser: meadow, cellar, Crater, the opening and the quest
  ui/             React panels over the canvas
  art/            the procedural Magic Block and rimeshell renderer, audio
scripts/          deploy, init, admin, copy-idl
```

## Credits

Built with [MagicBlock](https://magicblock.gg)'s Ephemeral Rollups, VRF, cranks, private accounts and Magic Actions.
The examples at `magicblock-labs/magicblock-examples` were the reference for every MagicBlock API; `test-utils/rust`
is copied from there. Art and audio come from the CC0 packs listed in [ASSETS.md](ASSETS.md): Ninja Adventure
(Pixel-boy), Kenney Tiny Dungeon and Kenney audio, and Pixelify Sans (OFL). No MagicBlock logo, no art or music from
any other game.

Design notes live in the parent folder (`docs/`), outside this repository.
