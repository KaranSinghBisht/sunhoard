# Progress
Milestone: M1 loop is in the client · Updated: Sat Nov 21, 6:50 PM IST

## Done
- Repo skeleton at `game/`. Examples cloned to `/tmp/mbx`. `test-utils/rust` copied. Art packs are in `assets-src/` (gitignored).
- Track D: seal, gather, roll expansion, one arena step, the first room, and the 70/20/10 payout split.
- Track A: every M1 instruction is in the default program except `debug_grant` and `debug_kill`, which are behind the `debug` feature. Program id `FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS`. One MagicSVM run goes from sign-up through a SOL claim.

## Doing
- A: devnet deploy and `ER_URL` are waiting on the student. The commands are `scripts/deploy-devnet.sh` and `scripts/init-game.ts`.
- B: the meadow is now a hand-laid, autotiled 60×40 map with a title card, night lighting and a practice cellar, on `http://127.0.0.1:5173/`. A first visit now gets a five-line opening and a five-step guided walk with a trail on the map. See `progress/B.md`. A wallet and a devnet deploy are still required before any transaction lands; none has.
- C: asset pipeline. Packs are downloaded.
- D: `economy.json` and codegen. The program is already calling the signatures in `progress/D.md`.

## Blocked, or needs the student
- Restart Cursor so its terminals use the new PATH.
- About 5 more devnet SOL on the admin key before the first deploy. Not deployed.
- `ER_URL` for the devnet rollup, in `scripts/.env`. The local MagicSVM run does not need it.
- Committed and pushed on the student's request, Sat Nov 21, 7:45 PM IST ✅: six commits on `main` at `https://github.com/KaranSinghBisht/sunhoard` (private). The submission checklist in `blitz/README.md` wants the repo public and accessible; the student flips it before submitting.

## Decisions (what changed from docs/, and why)
- See `progress/A.md` and `progress/D.md`. No design number was changed. Villagers stay Wednesday's extra.
- The Vault pays a claim by moving lamports. It is owned by the program, and the system program rejects a transfer from it.
- The season-1 payout account is created by `init_payout`, not `init_game`, so `init_game` stays inside the SBF stack limit.

## Contract changes (IDL, economy.json, logic/ signatures, strings.json keys)
- IDL at `target/idl/sunhoard.json`, copied to `client/src/gen/idl/sunhoard.json`. It lists the M1 instructions through `claim` and does not list `debug_grant` or `debug_kill`.
- `logic` signatures in `progress/D.md`, including `open_room`, `step_fight`, `room_clear`, and `stone_weapon`.

## ❓ answers (from HANDOFF.md §9)
- Unanswered. They need the devnet TEE. The local MagicSVM run is not that test.

## Test evidence (command and result)
- `cargo +1.89.0 test --lib`: 36 passed, 0 failed. rustc 1.89.0. Re-run Sat Nov 21, 5:01 AM IST after the claim, gather, and crank fixes.
- `anchor build`: exit 0. `target/deploy/sunhoard.so` is 1,010,488 bytes. That binary is the default build. It has no `DebugGrant` or `DebugKill` string. No `sunhoard` stack-offset error.
- `cargo +1.93.0 test --manifest-path tests-magicsvm-rs/Cargo.toml -- --nocapture m1_runs`: 1 passed in 0.57s, including `exit_dungeon`. Not deployed.
- `corepack yarn typecheck` exit 0 and `corepack yarn test` 13 passed, in `client/`, Sat Nov 21, 5:47 AM IST.
- The same MagicSVM run now also checks that a non-member cannot read World. 1 passed in 0.72s.
- Sat Nov 21, 5:48 PM IST ✅ re-run after the client rework: `cargo +1.89.0 test --lib` 36 passed; `cargo +1.93.0 test --manifest-path tests-magicsvm-rs/Cargo.toml` 1 passed in 0.57s; `corepack yarn typecheck` exit 0; `corepack yarn test` 20 passed; `corepack yarn build` built. `anchor build` was not re-run: no program file changed.
- Sat Nov 21, 6:30 PM IST ✅ after the opening and the first-night walk: `corepack yarn typecheck` exit 0; `corepack yarn test` 26 passed; `corepack yarn build` built. No program file changed, so the Rust tests were not re-run.
- Sat Nov 21, 6:50 PM IST ✅ after the text-readability fix in the client: `corepack yarn typecheck` exit 0; `corepack yarn test` 26 passed; `corepack yarn build` built.
