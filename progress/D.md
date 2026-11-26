# Independent audit and remediation handoff

**The finished record is `../../AUDIT.md`** (Fri Nov 27): every finding, its status, how it was verified and what was
not. The table below is Codex's baseline from before the fixes; tracks A–C were not updated separately.

## Baseline reviewed on 26 November 2026 IST

✅ The starting revision was `6c4e967`. The engineering and judge review scored the submission at **68/100**. The highest-impact gaps were an inaccessible public demo, wallet-boundary errors, and economic promises that the program did not consistently enforce. Historical evidence for this revision includes 66 Rust unit tests, four MagicSVM flows, 41 browser-library tests, a devnet settlement, and two 0.04 devnet SOL claims. Those transactions predate the changes below.

| Review area | Finding at baseline | Where to review the changes |
|---|---|---|
| Coldfair and village | 64 market slots shared a 48-slot check. Village arrays used inventory bounds. A purchase signed neither an agreed price nor a listing revision. | `instructions/market.rs`, village handlers, Coldfair UI and [track C](C.md) |
| Item and price display | The selector hid unopened shells, mislabeled revealed blocks and posted immediately. Demo provenance, gear fodder, thaw fees and rounding were inconsistent. | Coldfair, Pack, Anvil, Barn, generated economy tables and [track C](C.md) |
| Identity and receipts | Disconnect, switching owner and expiry could retain player state. Explorer links carried a bearer credential. A confirmation failure could discard a signed receipt. | `client/src/chain/`, wallet providers, chain watchers and [track B](B.md) |
| Season and raid | Survival could block rollover. Stale visits could settle in the wrong phase. Entry reserved a scarce damage row. Eligibility depended on lifetime clears. | Season, arena, exit, lair and [track A](A.md) |
| Prize and claims | The fee pot was denominated in Glints and the separately funded prize paid SOL. Players lacked distinct claim status, deadlines and settlement guidance. | Season and payout accounts, claim UI, operator CLI and [track A](A.md) |
| Seals and bell | Rotating secrets could strand old shells after charging. Dust and removing a post lost proof data. Bell cooldown and callback correlation were incomplete. | Crack, season secrets, barn, bell, item provenance and [track C](C.md) |
| Map and economy | The program trusted gather coordinates. A zone round trip bypassed meadow travel. Prices and anvil odds used two implementations without shared evidence. | Gather, position, `economy/`, `client/src/shared/economy.ts` |
| First play | Practice and live play looked alike. Quest steps could advance before confirmation. Refresh could lose an active arena. Panels obscured desktop play and overflowed mobile. | App, meadow, arena, CSS and [track B](B.md) |
| Verification and release | The privacy script could succeed on a readable secret or an unavailable RPC. Clean simulator setup omitted its debug build. The browser bundle loaded wallet code up front. Vite listened on the LAN by default. | Live harness, release smoke, build scripts, Vite config and [track B](B.md) |
| Submission | The audit found no anonymously usable hosted client or video. The public description conflated trade fees and SOL. | README, parent `SUBMISSION.md`, student release checks below |

Earlier track D notes below are a chronological record of the original build.

# Progress
Milestone: L1 rules live in `logic/`, mirrored in TS · Updated: Sat Nov 21, 9:45 PM IST

## Done
- Pure rules in `programs/sunhoard/src/logic/`: seal, gather, VRF-byte rolls, the dungeon and lair sims, the market and anvil math, payout split.
- Rule tests still pass. The crate's full `cargo test --lib` is 52 passed, including the aurora clock, the thaw fees, the first room, the Snuffer, the chest rolls, the recipes, the rarity and trait rolls, Pell's prices and the Season damage-table offset.
- L1 numbers came straight from docs/ECONOMY.md: recipes, Charter and shop prices, gear rarity and trait rolls, the six-room run, the Snuffer (900 HP, Ember Volley 10, Wick Lines 16, Snuff 18 + frost), the chest tiers with the daily cap, and the first-clear boss block.
- The TS mirror `client/src/shared/fight.ts` matches `logic/arena.rs` and `logic/fight.rs` step for step, including shots, the Snuffer's telegraphs and the frost slow. Vitest: 27 passed.

## Doing
- D: `economy.json` and codegen are still open. The program is calling the signatures below plus the L1–L3 ones in `progress/A.md`.
- A: L4 stretch work next. See `progress/A.md`.
- B: L1 client done; L2/L3 panels next. See `progress/B.md`.
- C: art packs are in `assets-src/`. The pipeline is not started.

## Blocked, or needs the student
- Toolchain and art packs are in place. A fresh shell reports Anchor 1.0.2, Agave 3.1.11, Rust 1.89.0, Node 24.10.0. Agave 3.1.11 is the kept version; the examples pin 3.1.9.
- Restart Cursor so its terminals use the new PATH. This shell still needed the prefix.
- About 5 more devnet SOL before the first deploy. Not deployed.

## Decisions (what changed from docs/, and why)
- No economy number was changed. These fill gaps the notes leave to the implementation:
- Fatigue rounds down on each gather. One wood after 500 energy spent today pays 0. An aberration is 20× the base yield, then the same divide, so it still pays.
- Aberration thresholds are integer parts per million: `1_000_000/400 = 2500` and `1_000_000/120 = 8333`.
- A stone or coal aberration pays 20× that node. The item kind stays the node's kind.
- If nobody qualifies for the 20% equal share, that slice stays unpaid. It is not added to the damage pool.
- If no row is marked the killer, the 10% stays unpaid. Two killer flags is an error.
- A share over 40% is clipped. The excess is offered by damage to wallets still under the cap, and never past the cap. Whatever cannot be placed stays unpaid.
- A wallet at exactly 2% of damage qualifies for the equal share. The T1-clear and age checks are arguments. Live age is 86400 seconds.
- A Crater shell reveals two blocks. A Large shell reveals a second block on a 15% roll. Small and Medium reveal one block or frost dust.
- The second block is `sha256(key ‖ 0x01)`, so it does not reuse the first block's bytes.
- This arena step moves the rat, the slime, the bat and the Snuffer. The Snuffer telegraphs 6 steps before each attack: Ember Volley (three shots of 10), Wick Lines (two diagonal shots of 16) and Snuff (a teleport next to the keeper, 18 damage and 2 s of frost).
- A diagonal step moves `181/256` of the cardinal speed on each axis, so a diagonal is not faster.
- One gather pays 1 unit. A birch that yields 2 wood is two gathers. Energy: birch, rock, coal, and berry cost 1; ore costs 3.
- If the clock moves backwards, energy does not refill and the call is not an error.
- Item kind numbers (`KIND_WOOD = 1` and the rest in `logic/ids.rs`) are provisional until `economy.json` owns them.
- The aurora is up for the first 600 seconds of every 1,800. A negative timestamp is not up.
- Overworld movement allows 80 units a second, and a zone change is always allowed.
- Thaw fees are the economy table in Glint hundredths: 500, 1,200, 3,000, 0, and 0 for the boss block. No economy number was changed.
- The first dungeon room is 256 by 256. The player starts at (32, 128). Three foes are placed from the seed. The default weapon is stone, common, with keen 0 and brutal 0.
- A clear pays 100 Glint hundredths and 2 Wickwax. `KIND_WICKWAX` is 6, provisional until `economy.json` owns the kind ids. No economy number was changed.
- L1 rules: six rooms hold 5/6/7/6/7 monsters from three layouts; the boss block is shell kind 4, thawed free, grade odds 70/25/5; crafted gear rolls rarity from stone/iron or gilded tables and traits from the tool or weapon pool with the flaw chance per rarity; Efficient and Bountiful apply to gathering, Keen and Brutal to the dungeon weapon; chests cap at 6 a day per tier and then drop a tier; the first clear of the day also drops the boss block.

## Contract changes (IDL, economy.json, logic/ signatures, strings.json keys)
Track A should call these and not reimplement them. `constants_stub.rs` re-exports `logic::ids` and `logic::numbers` until codegen writes `constants.rs`.

- `logic::seal_key(salt: &[u8; 32], item_id: u64) -> [u8; 32]`
- `logic::commitment(key: &[u8; 32]) -> [u8; 32]`
- `logic::reveal_shell(key: &[u8; 32], shell: u8) -> Result<RevealedShell, LogicError>`
- `logic::gather_base(node: u8, energy_used_today: u32, tool: ToolBonus) -> Result<GatherBase, LogicError>`
- `logic::gather_callback(node: u8, energy_used_today: u32, tool: ToolBonus, vrf: &[u8; 32], aurora_up: bool) -> Result<GatherExtra, LogicError>`
- `logic::in_gather_range(px, py, nx, ny: u16) -> bool`
- `logic::cooldown_ready(last_unix: i64, now_unix: i64) -> bool`
- `logic::refill_energy(stored: u32, last_unix: i64, now_unix: i64) -> Result<(u32, i64), LogicError>`
- `logic::aurora_up(now_unix: i64) -> bool`
- `logic::move_allowed(from_x, from_y, to_x, to_y: u16, dt_secs: i64, zone_changed: bool) -> bool`
- `logic::thaw_fee(shell: u8) -> Result<u64, LogicError>`
- `logic::roll::expand(seed: &[u8; 32], step: u64) -> [u8; 32]`
- `logic::roll::expand_hit(seed: &[u8; 32], step: u64, hit: u16) -> [u8; 32]`
- `logic::combat::hit_damage(material: u8, rarity: u8) -> Result<u16, LogicError>`
- `logic::combat::attack_damage(weapon: &Weapon, seed: &[u8; 32], step: u64, hit: u16) -> Result<i32, LogicError>`
- `logic::step_arena(sim: &mut ArenaSim, intent: Intent, seed: &[u8; 32], weapon: &Weapon) -> Result<(), LogicError>`
- `logic::stone_weapon() -> Weapon`
- `logic::open_room(seed: &[u8; 32], room: u8, start_hp: i32) -> Result<Fight, LogicError>`
- `logic::step_fight(fight: &mut Fight, intent: Intent, seed: &[u8; 32], weapon: &Weapon) -> Result<(), LogicError>`
- `logic::room_clear(fight: &Fight) -> bool`
- `logic::split_pot(pot: u64, rows: &[DamageRow], min_age_secs: u64) -> Result<Split, LogicError>`
- L1: `logic::chest::{roll_chest, first_clear_block, chest_gear_kind, shell_for}`, `logic::craft::{recipe_by_id, roll_rarity, roll_traits, is_gear_recipe, Recipe, TraitRoll}`, `logic::merchant::{charter_material, shop_price, charter_gear, charter_block, charter_shell, sell_material, sell_gear, sell_block, sell_shell}`.

Shell ids: Small 0, Medium 1, Large 2, Crater 3, Boss 4. Node ids: birch 0, rock 1, coal 2, ore 3, berry 4. Monster ids: rat 0, slime 1, bat 2, Snuffer 3. Weapon material: stone 0, iron 1, gilded 2. Rarity: Common 0 through Legendary 4.

## ❓ answers (from HANDOFF.md §9)
- None yet. These need a deployed program on the devnet TEE.

## Test evidence (command and result)
`cargo +1.89.0 test --lib` in `game/`, rustc 1.89.0 (29483883e 2025-08-04), Sat Nov 21, 9:40 PM IST.

```
test result: ok. 52 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

Client: `corepack yarn typecheck` exit 0 and `corepack yarn test` → 27 passed, Sat Nov 21, 9:45 PM IST.
