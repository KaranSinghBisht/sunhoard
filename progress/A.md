# Progress
Milestone: L2 and L3 run in MagicSVM · Updated: Mon Nov 23, 12:57 AM IST

## Done
- `game/` exists: workspace, `Anchor.toml` pinned to Anchor 1.0.2, `rust-toolchain.toml` 1.89.0, `.tool-versions` node 24.10.0, `.gitignore`.
- `test-utils/rust` copied from `/tmp/mbx/test-utils/rust` (magicblock-examples). Credited in `game/README.md`.
- MagicBlock examples are cloned at `/tmp/mbx`.
- The program crate compiles against crates.io `ephemeral-rollups-sdk` 0.16.2 with `anchor`, `access-control`, `vrf`, `crank`, and `instruction`, plus `session-keys` 3.1.1.
- `init_game` creates Season, World, Market, PriceBoard, Presence and the Vault. It prefunds permission rent on the five accounts that will be delegated, transfers the caller's SOL amount into the Vault, and tops up the Magic Action escrow.
- `delegate_shared` delegates those five accounts. The Vault stays on Solana and its admin must sign. An account already owned by the delegation program is skipped, so a retry can finish the rest.
- `set_permissions_shared` runs on the rollup. World is created private with no members. Season, Market, PriceBoard and Presence are created public. An existing permission account is left as it is.
- `start_season` asks the VRF for a salt. `salt_cb` writes it into World, seals Old Gloam's HP at 85–115% of 66,000 (8,000 in demo mode), and opens season 1. The salt is not logged. The caller seed is thirty-two zero bytes, so the admin cannot grind it.
- `sign_up` creates Player, Purse, Inventory, Village, Arena and View, and prefunds permission rent for Purse and View.
- `delegate_player` delegates Player, Purse and Inventory. `delegate_home` delegates Village, Arena and View. One instruction for all six overflowed the SBF stack by 8 bytes.
- `join` requires an open season, assigns the player number, gives a bound Dim Dawn block and bound Nell, makes Purse and View private to the owner, and places the keeper at the meadow spawn (360, 312) so the first position post is not a leap from (0, 0).
- `post_position` is session-signed. Movement inside a zone is capped at 80 units a second, the combat speed. A zone change is not distance-checked, because each zone has its own coordinates.
- `gather` is session-signed. It refills energy, checks the 3 s cooldown and the 1.5-tile range, pays the base yield, and asks the VRF for the aberration. `gather_cb` adds that bonus, or nothing. The roll is not logged. The equipped tool's Efficient and Bountiful traits change the energy cost and the yield.
- `crack` charges the thaw fee from the Purse and marks the shell. `crack_reveal` must be a later slot. It checks the commitment against World's salt, writes the key and the gem, and pays frost dust when the shell is not a block. The salt is not logged.
- `debug_grant` gives one sealed Small rimeshell. `debug_kill` appends at most 16 damage rows and, when finish is 1, sets World HP to 0. Both compile only with `--features debug`. The default binary does not contain them.
- `init_payout` creates the season-1 payout record on Solana. It stays out of `init_game` because one more account overflowed the SBF stack. The record is zero-copy so the payout handler does not copy it onto the stack.
- `enter_dungeon` arms the arena, reads the equipped gear (material, rarity, Keen, Brutal), asks the VRF for a room seed, and schedules `tick_arena` every 100 ms for 8,000 iterations. `arena_input` stores the move. `tick_arena` steps once the seed is in and at least 8 slots have passed, and sets `cleared` when the room falls. `exit_dungeon` cancels that crank.
- **L1 the loop:** `next_room` advances after a clear, heals 30% at the lantern and rolls a fresh seed. The run is 6 rooms of 5–7 monsters (3 layouts reused) and the Snuffer in room 6: HP 900, three telegraphed attacks (Ember Volley 10, Wick Lines 16, Snuff 18 with frost −40% speed for 2 s). Shots live in the arena. Clearing room 6 banks 1 Glint + 2 Wickwax and rolls the boss chest (`exit_dungeon` requests VRF; `chest_cb` pays Glints, iron gear and a rimeshell by tier, plus the first-clear boss block). After 6 chests a day the tier drops by one.
- `craft` pays material recipes at once; gear recipes consume the inputs and wait for one VRF roll of rarity and traits (`craft_cb`). Pell: `merchant_sell` pays the Charter price (materials, gear base × rarity, blocks by grade × (0.75 + 0.5 × purity), sealed shells), +50% on a Want; `merchant_buy` sells her shop goods and plain gear. `eat` restores 25 energy from a meal, 4 a day. `equip` picks the gear the dungeon reads.
- `settle_season` commits Season and schedules `record_payout`. `claim` pays the wallet from the Vault by moving lamports. The Vault is program-owned, so a system transfer is rejected.
- The `#[ephemeral]` macro also emits `process_undelegation`. That is the SDK's instruction, not a game instruction.
- `anchor build` wrote `target/deploy/sunhoard.so` (986 KB) and `target/idl/sunhoard.json`.
- Program id: `FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS`.
- The program keypair is `~/.config/solana/sunhoard-program.json`, outside the repo, mode 600. A copy sits in `target/deploy/` for Anchor. `target/` is gitignored. If `target/` is deleted, copy the outside keypair back before the next build.

## Doing
- A: bug-fix audit Mon Nov 23 (see Done). Deploy still waiting on the student.
- B: thaw verify fix landed with the audit.
- C: art packs are in `assets-src/`. The pipeline is not started.
- D: see `progress/D.md`.

## Blocked, or needs the student
- Restart Cursor so its own terminals pick up the new PATH. This shell still needed the PATH prefix.
- Deploy rent for the current `.so` (1,515,448 bytes) is 7.70 SOL ✅. A deploy holds that twice ⚠️, so the admin key needs about 16 SOL and has 5 ✅. Not deployed.

## Decisions (what changed from docs/, and why)
- `Anchor.toml` wallet is `~/.config/solana/sunhoard-admin.json`, matching the updated handoff. The admin key stays outside the repo.
- crates.io SDK 0.16.2 does include `crank`. `ScheduleCrankCpi` and `CancelCrankCpi` are public. `ScheduleTaskArgs` is not re-exported, so instructions will name it from `magicblock-magic-program-api` 0.10.1, the same crate the SDK already depends on. One SDK copy.
- Anchor's own crates use a caret on 1.0.2, and Cargo was selecting 1.2.2 for the derives. That mix breaks `session-keys` 3.1.1 (`CreateAccountAllowPrefund` is not in the 1.0.2 runtime). The program pins every `anchor-*` crate to `=1.0.2`.
- A listing stores the item without `cracking_since`. A cracking shell cannot be listed, and 64 full slots plus seller, price and both times would pass 10 KB. The inventory slot still keeps the slot number.
- The escrow top-up is 10,000 lamports at index 255, copied from the magic-actions example and `ActionArgs::new`. Raise it when `settle_season` is tested if one action costs more.
- Permission rent uses `EphemeralPermission::size_of(0)`. World has no members. The other shared accounts are created public with no members.
- Anchor 1.0's program macro looks for the Accounts struct and its generated modules at the crate root. `lib.rs` re-exports them. `CpiContext::new` takes the program id, not the program account.
- `delegate_shared` takes the validator as an account instead of hardcoding it. The caller should pass the TEE validator from the private-counter example, `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`. The delegated accounts are unchecked, matching that example, because after delegation the delegation program owns them and an Anchor owner check would reject a retry. The Vault's `has_one` check still requires the stored admin.
- Woodcutter's profession id is 1. Empty villager slots stay at id 0. Nell's starter block is tone Dawn, grade Dim, bound and pristine. Item ids are the player number times 2^40 plus the player's counter. The first player is 1.
- Overworld speed is 80 units a second. `Player.moved_at` stores the last accepted position time.
- Gather node coordinates come from the player. There is no node account yet, so the chain checks range, energy, cooldown, and the node id. A missed VRF callback leaves `GATHER_PENDING` set and blocks another gather. The caller seed is 24 bytes of the owner plus the request nonce, and the callback must send that nonce back.
- The aurora is the first 10 minutes of every 30, from the unix clock. The aberration uses the energy spent before this gather, same as the base yield.
- Material stacks share a kind, have no item id and no flags, and hold at most 65,535. A second stack opens when one is full.
- Thaw fees are 500, 1,200, 3,000, 0, and 0 Glint hundredths (5, 12, 30, 0, 0 Glints). The fee is added to `Season.burned` and removed from the Purse. Thawhand is not applied yet. A listed shell cannot be cracked. A second gem gets a new item id. Dust clears the slot and pays the Purse.
- The crank call uses the same `MagicBlockInstruction::ScheduleTask` and `CancelTask` bytes as `ScheduleCrankCpi`. The CPI struct holds the account infos for the whole context lifetime, which the local accounts cannot satisfy.
- A dungeon tick does not change World's HP. `debug_kill` fills the damage table so settle can run without the lair. The first room is 256 by 256 with three foes, and the weapon is stone until `equip` exists.
- Clearing that room pays 100 Glint hundredths and 2 Wickwax. Wickwax's kind id is 6, provisional like the other kind ids.
- `delegate_shared` does not fit in the default 200,000 compute units. The test and `scripts/init-game.ts` request 1,400,000.
- MagicSVM tests compile with Rust 1.93.0. `solana-syscalls` 4.2.2 does not compile on 1.89 or on stable 1.92. The program binary stays on the 1.89 SBF build.
- A claim marks the row claimed before it moves lamports. Both writes are in the same instruction, so a failed move rolls the mark back.
- A gather whose VRF callback never arrives can be tried again after 30 seconds. That next gather is a new chop and pays its own base yield. `energy_used_today` resets when the unix day changes. A player with number 0 cannot gather.
- Each room's crank task id is a hash of the owner and the run nonce, so two players do not share task 1.
- L1 additions (see `progress/D.md` for the numbers): the run is six rooms with 5–7 monsters; the Snuffer is a foe kind with telegraphed shot attacks; the boss block is a fifth shell kind thawed free with grade odds 70/25/5; crafted gear rolls rarity and traits from one VRF request; the meal counter and the equipped slot live on the Player; the chest roll happens in `exit_dungeon` on the sixth room, not inside the crank, because the crank cannot pay the player.
- `next_room` runs from the cleared-fight state (`cleared` set by the tick), because nothing else returns the arena to idle mid-run.
- `start_season` may be asked again 120 s after a dropped salt callback, so a lost request cannot brick the season. `scripts/init-game.ts` now skips `start_season` when the season is already open.
- L2: the Coldfair lists into the Market with a 1-Glint deposit burned at list and refunded on sale; the Hearth Penny is 5% of the price, half to the pot and half burned, and `buy` moves both purses, the item and the split in one instruction. The seller's purse is checked by hand against the listing's seller PDA. Expiry is enforced at buy time; the seller cancels to reclaim.
- L2: the anvil consumes the item's own Charter value plus fodder and Glints; odds are 80% × inputs ÷ target plus heat, refused under 30% before heat, capped at 80%; the fee is 5% of the target; a win raises the rarity and re-rolls the new trait slot, a crack returns 10% scrap and heats the anvil +5 (cap 15, 30-minute idle reset). The stake goes to the pot on a fail and burns on a win.
- L2: the lair runs as a third arena mode. The Glare marks a keeper whose private purse is ≥ 500 Glints and warmer than every earlier entrant; the marked keeper deals ×1.5 and takes ×1.3. The visit is Rime 60 s → Gloaming 60 s → Noon 30 s at double speed, with breath, hail, beams, tail sweeps, dashes and sunbursts; darkness gnaws outside the four lantern circles; every 10th Gloaming hit spills a spark worth 0.05% of the pot (max 10 Glints) that heals Old Gloam if not scooped in 3 s. Damage flushes to World and the damage table every 0.5 s; the wallet's age rides on its damage row.
- L3: `schedule_world` starts one season-clock crank; `tick_world` runs the phase clock (half the pot burns if the Long Night ends with Old Gloam alive), rotates Pell's Wants hourly and posts three bounties daily, deterministically from the season salt. First Light (Spring's first hour, 1 min in demo) waives the Hearth Penny.
- L3: the barn: `place_gem` and `take_gem` move blocks between the pack and built lantern posts, settling villager output at the old warmth first; `collect` pays the stockpile, `feed` fills it, the bell (`ring_bell` + VRF `bell_cb`) brings a wanderer for a free bed and workstation, and `recruit` keeps them for 15 Glints. The post, bed and workstation recipes (13–15) build the barn.
- L3: `set_demo_mode` flips the demo flag (the clock, chest odds and bell read it); `demo_grant` mints a gear item or a sealed shell tagged DEMO, demo mode only.
- The wanderer's villager id comes from the player's own item counter, like Nell's.
- Workstations come up as Woodcutter stations; more professions are L4 polish. Bounty claims are not built (the cut ladder cuts bounties before villagers).
- Mon Nov 23, 12:57 AM IST ✅ bug fixes from the audit pass:
  - `crack_reveal` now marks thawed blocks `PRISTINE` (and keeps `BOUND` / `DEMO`).
  - `place_gem` / `take_gem` keep `PRISTINE` | `BOUND` | `DEMO` on the post so Nell's starter stays bound after a round trip.
  - Anvil fodder uses `on_the_anvil` instead of the raw `FORGING` bit, so a lost roll's item can be fodder again after release.
  - Gear `craft`: a lost VRF roll (30 s) or a full pack on `craft_cb` refunds the inputs instead of burning them.

## Contract changes (IDL, economy.json, logic/ signatures, strings.json keys)
- Program id above. `scripts/copy-idl` copied the IDL to `client/src/gen/idl/sunhoard.json`. Instructions: `init_game`, `init_payout`, `delegate_shared`, `set_permissions_shared`, `start_season`, `salt_cb`, `sign_up`, `delegate_player`, `delegate_home`, `join`, `post_position`, `gather`, `gather_cb`, `crack`, `crack_reveal`, `enter_dungeon`, `dungeon_cb`, `arena_input`, `tick_arena`, `next_room`, `chest_cb`, `exit_dungeon`, `craft`, `craft_cb`, `merchant_sell`, `merchant_buy`, `eat`, `equip`, `list`, `cancel`, `buy`, `strike`, `strike_cb`, `enter_lair`, `lair_cb`, `lair_input`, `tick_lair`, `exit_lair`, `catch_spark`, `schedule_world`, `tick_world`, `place_gem`, `take_gem`, `collect`, `feed`, `ring_bell`, `bell_cb`, `recruit`, `set_demo_mode`, `demo_grant`, `settle_season`, `record_payout`, `claim`, and the SDK's `process_undelegation`. `debug_grant` and `debug_kill` are not in this IDL.
- Account seeds: `season`, `world`, `market`, `prices`, `presence`, `vault`.
- `logic` gained `aurora_up`, `move_allowed`, and `thaw_fee`. See `progress/D.md`.

## ❓ answers (from HANDOFF.md §9)
- None yet.

## Test evidence (command and result)
Commands used `PATH="$HOME/.avm/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"` because this Cursor shell was started before the `~/.zshrc` change. A fresh shell already has that PATH.

- `anchor --version` → anchor-cli 1.0.2. `solana --version` → 3.1.11. Inside `game/`, `rustc --version` → 1.89.0. `node --version` → v24.10.0.
- `cargo +1.89.0 test --lib --quiet` → 64 passed; 0 failed. rustc 1.89.0. Sat Nov 21, 10:30 PM IST.
- `anchor build` → exit 0; `target/deploy/sunhoard.so` is 1,515,448 bytes (the default binary, no debug instructions). The anchor-syn stack notes are tolerated, as before.
- `cargo-build-sbf --features debug --sbf-out-dir target/sbf-debug` → exit 0.
- `cargo +1.93.0 test --manifest-path tests-magicsvm-rs/Cargo.toml` → 3 passed in 56 s: `m1_runs_from_sign_up_through_a_claim`, `l1_runs_the_loop` (45 s) and `l2_runs_the_spine`. The L2 run lists and cancels a stack, strikes the anvil (accepting a win or a crack), enters the lair and checks the Glare stays dark at 100 Glints, ticks the visit and leaves, builds a post, bed and workstation, sets Nell's block in the post and takes it back, rings the bell, collects, grants a DEMO-tagged legendary blade in demo mode, and ticks the season clock.
- Not deployed. `scripts/deploy-devnet.sh` and `scripts/init-game.ts` are written and were not run. The admin key has about 5 devnet SOL. The first deploy wants more.
- Mon Nov 23, 12:57 AM IST ✅ after the audit fixes: `cargo +1.89.0 test --lib` 66 passed; `cargo +1.93.0 test --manifest-path tests-magicsvm-rs/Cargo.toml` 4 passed in 155 s (`m1`, `l1`, `l2`, `l3_a_real_kill_pays_every_share`). Not deployed.
