# Progress
Milestone: M1 rules, called by the program and the MagicSVM run · Updated: Sat Nov 21, 3:57 AM IST

## Done
- Pure rules in `programs/sunhoard/src/logic/`: seal, gather, VRF-byte rolls, one arena step, payout split.
- Rule tests still pass. The crate's full `cargo test --lib` is 36 passed, including the aurora clock, the thaw fees, the first room, and the Season damage-table offset.

## Doing
- D: `economy.json` and codegen are still open. The program is calling the signatures below.
- A: M1 instructions run in MagicSVM. See `progress/A.md`.
- B: not started.
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
- This arena step moves the rat, the slime, and the bat. Boss attack patterns are not in it yet.
- A diagonal step moves `181/256` of the cardinal speed on each axis, so a diagonal is not faster.
- One gather pays 1 unit. A birch that yields 2 wood is two gathers. Energy: birch, rock, coal, and berry cost 1; ore costs 3.
- If the clock moves backwards, energy does not refill and the call is not an error.
- Item kind numbers (`KIND_WOOD = 1` and the rest in `logic/ids.rs`) are provisional until `economy.json` owns them.
- The aurora is up for the first 600 seconds of every 1,800. A negative timestamp is not up.
- Overworld movement allows 80 units a second, and a zone change is always allowed.
- Thaw fees are the economy table in Glint hundredths: 500, 1,200, 3,000, 0. No economy number was changed.
- The first dungeon room is 256 by 256. The player starts at (32, 128). Three foes are placed from the seed. The default weapon is stone, common, with keen 0 and brutal 0.
- A clear pays 100 Glint hundredths and 2 Wickwax. `KIND_WICKWAX` is 6, provisional until `economy.json` owns the kind ids. No economy number was changed.

## Contract changes (IDL, economy.json, logic/ signatures, strings.json keys)
Track A should call these and not reimplement them. `constants_stub.rs` re-exports `logic::ids` and `logic::numbers` until codegen writes `constants.rs`.

- `logic::seal_key(salt: &[u8; 32], item_id: u64) -> [u8; 32]`
- `logic::commitment(key: &[u8; 32]) -> [u8; 32]`
- `logic::reveal_shell(key: &[u8; 32], shell: u8) -> Result<RevealedShell, LogicError>`
- `logic::gather_base(node: u8, energy_used_today: u32) -> Result<GatherBase, LogicError>`
- `logic::gather_callback(node: u8, energy_used_today: u32, vrf: &[u8; 32], aurora_up: bool) -> Result<GatherExtra, LogicError>`
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
- `logic::open_room(seed: &[u8; 32]) -> Result<Fight, LogicError>`
- `logic::step_fight(fight: &mut Fight, intent: Intent, seed: &[u8; 32], weapon: &Weapon) -> Result<(), LogicError>`
- `logic::room_clear(fight: &Fight) -> bool`
- `logic::split_pot(pot: u64, rows: &[DamageRow], min_age_secs: u64) -> Result<Split, LogicError>`

Shell ids: Small 0, Medium 1, Large 2, Crater 3. Node ids: birch 0, rock 1, coal 2, ore 3, berry 4. Monster ids: rat 0, slime 1, bat 2. Weapon material: stone 0, iron 1, gilded 2. Rarity: Common 0 through Legendary 4.

## ❓ answers (from HANDOFF.md §9)
- None yet. These need a deployed program on the devnet TEE.

## Test evidence (command and result)
`cargo +1.89.0 test --lib` in `game/`, rustc 1.89.0 (29483883e 2025-08-04), after the Anchor crates were added.

```
test result: ok. 36 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```
