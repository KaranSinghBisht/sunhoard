# Progress
Milestone: M1 instructions run in MagicSVM · Updated: Sat Nov 21, 5:01 AM IST

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
- `join` requires an open season, assigns the player number, gives a bound Dim Dawn block and bound Nell, and makes Purse and View private to the owner.
- `post_position` is session-signed. Movement inside a zone is capped at 80 units a second, the combat speed. A zone change is not distance-checked, because each zone has its own coordinates.
- `gather` is session-signed. It refills energy, checks the 3 s cooldown and the 1.5-tile range, pays the base yield, and asks the VRF for the aberration. `gather_cb` adds that bonus, or nothing. The roll is not logged.
- `crack` charges the thaw fee from the Purse and marks the shell. `crack_reveal` must be a later slot. It checks the commitment against World's salt, writes the key and the gem, and pays frost dust when the shell is not a block. The salt is not logged.
- `debug_grant` gives one sealed Small rimeshell. `debug_kill` appends at most 16 damage rows and, when finish is 1, sets World HP to 0. Both compile only with `--features debug`. The default binary does not contain them.
- `init_payout` creates the season-1 payout record on Solana. It stays out of `init_game` because one more account overflowed the SBF stack. The record is zero-copy so the payout handler does not copy it onto the stack.
- `enter_dungeon` arms the arena, asks the VRF for a room seed, and schedules `tick_arena` every 100 ms for 8,000 iterations. `arena_input` stores the move. `tick_arena` steps once the seed is in and at least 8 slots have passed. `exit_dungeon` cancels that crank.
- `settle_season` commits Season and schedules `record_payout`. `claim` pays the wallet from the Vault by moving lamports. The Vault is program-owned, so a system transfer is rejected.
- The `#[ephemeral]` macro also emits `process_undelegation`. That is the SDK's instruction, not a game instruction.
- `anchor build` wrote `target/deploy/sunhoard.so` (986 KB) and `target/idl/sunhoard.json`.
- Program id: `FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS`.
- The program keypair is `~/.config/solana/sunhoard-program.json`, outside the repo, mode 600. A copy sits in `target/deploy/` for Anchor. `target/` is gitignored. If `target/` is deleted, copy the outside keypair back before the next build.

## Doing
- A: the M1 instruction path runs in MagicSVM, from sign-up through a claim. Devnet still needs the student to deploy and to set `ER_URL`.
- B: not started.
- C: art packs are in `assets-src/`. The pipeline is not started.
- D: rules for M1 are in `progress/D.md`. `economy.json` is not generated.

## Blocked, or needs the student
- Restart Cursor so its own terminals pick up the new PATH. This shell still needed the PATH prefix.
- About 5 more devnet SOL on `J3t6hH4fcyuKbyXyS3iv9t9c9XZzpbDFaHXfVn2JPk2d` before the first deploy. Not deployed.

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
- Thaw fees are 500, 1,200, 3,000, and 0 Glint hundredths (5, 12, 30, and 0 Glints). The fee is added to `Season.burned` and removed from the Purse. Thawhand is not applied yet. A listed shell cannot be cracked. A second gem gets a new item id. Dust clears the slot and pays the Purse.
- The crank call uses the same `MagicBlockInstruction::ScheduleTask` and `CancelTask` bytes as `ScheduleCrankCpi`. The CPI struct holds the account infos for the whole context lifetime, which the local accounts cannot satisfy.
- A dungeon tick does not change World's HP. `debug_kill` fills the damage table so settle can run without the lair. The first room is 256 by 256 with three foes, and the weapon is stone until `equip` exists.
- Clearing that room pays 100 Glint hundredths and 2 Wickwax. Wickwax's kind id is 6, provisional like the other kind ids.
- `delegate_shared` does not fit in the default 200,000 compute units. The test and `scripts/init-game.ts` request 1,400,000.
- MagicSVM tests compile with Rust 1.93.0. `solana-syscalls` 4.2.2 does not compile on 1.89 or on stable 1.92. The program binary stays on the 1.89 SBF build.
- A claim marks the row claimed before it moves lamports. Both writes are in the same instruction, so a failed move rolls the mark back.
- A gather whose VRF callback never arrives can be tried again after 30 seconds. That next gather is a new chop and pays its own base yield. `energy_used_today` resets when the unix day changes. A player with number 0 cannot gather.
- Each room's crank task id is a hash of the owner and the run nonce, so two players do not share task 1.

## Contract changes (IDL, economy.json, logic/ signatures, strings.json keys)
- Program id above. `scripts/copy-idl` copied the IDL to `client/src/gen/idl/sunhoard.json`. Instructions: `init_game`, `init_payout`, `delegate_shared`, `set_permissions_shared`, `start_season`, `salt_cb`, `sign_up`, `delegate_player`, `delegate_home`, `join`, `post_position`, `gather`, `gather_cb`, `crack`, `crack_reveal`, `enter_dungeon`, `dungeon_cb`, `arena_input`, `tick_arena`, `exit_dungeon`, `settle_season`, `record_payout`, `claim`, and the SDK's `process_undelegation`. `debug_grant` and `debug_kill` are not in this IDL.
- Account seeds: `season`, `world`, `market`, `prices`, `presence`, `vault`.
- `logic` gained `aurora_up`, `move_allowed`, and `thaw_fee`. See `progress/D.md`.

## ❓ answers (from HANDOFF.md §9)
- None yet.

## Test evidence (command and result)
Commands used `PATH="$HOME/.avm/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"` because this Cursor shell was started before the `~/.zshrc` change. A fresh shell already has that PATH.

- `anchor --version` → anchor-cli 1.0.2. `solana --version` → 3.1.11. Inside `game/`, `rustc --version` → 1.89.0. `node --version` → v24.10.0.
- `cargo +1.89.0 test --lib --quiet` → `test result: ok. 36 passed; 0 failed`. rustc 1.89.0. The same count passes with `--features debug`. That feature build is not the deploy binary.
- `anchor build` → exit 0, rebuilt Sat Nov 21, 5:01 AM IST after the claim, gather, and crank fixes. `target/deploy/sunhoard.so` is 1,010,488 bytes. The IDL lists the instructions above and does not list `debug_grant` or `debug_kill`. The SBF log has no `sunhoard` stack-offset error. It still prints stack-size notes from `anchor_syn`.
- `cargo-build-sbf --features debug --sbf-out-dir target/sbf-debug` writes the test binary. `strings` on `target/deploy/sunhoard.so` finds no `DebugGrant` or `DebugKill`.
- `cargo +1.93.0 test --manifest-path tests-magicsvm-rs/Cargo.toml -- --nocapture m1_runs` → `test result: ok. 1 passed` in 0.72s at Sat Nov 21, 5:48 AM IST. The run signs up, delegates, sets permissions, opens the season from VRF, joins, posts a position, gathers and receives the callback, thaws a debug shell in two slots, enters a room, ticks it, leaves it (the crank task id goes back to 0), kills the season, records the payout, and claims SOL. After permissions, a stranger's read of World on the rollup returns nothing, and Season still returns the account. The purse is given 500 Glint hundredths in the test before delegation, because a Small thaw costs 500 and a clear pays 100.
- Not deployed. `scripts/deploy-devnet.sh` and `scripts/init-game.ts` are written and were not run. The admin key has about 5 devnet SOL. The first deploy wants more.
