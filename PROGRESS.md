# Progress
Milestone: audit bug-fix pass · Updated: Mon Nov 23, 12:57 AM IST

## Done
- Repo skeleton at `game/`. Examples cloned to `/tmp/mbx`. `test-utils/rust` copied. Art packs are in `assets-src/` (gitignored).
- Track D: seal, gather, roll expansion, the dungeon and lair sims, the market and anvil math, the season clock, and the 70/20/10 payout split.
- Track A: every M1, L1, L2 and L3 instruction is in the default program except `debug_grant` and `debug_kill`, which are behind the `debug` feature. Program id `FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS`. Four MagicSVM runs: sign-up through a claim, the full L1 loop, the L2/L3 spine, and a real kill that pays every share.
- Track B: the meadow, the opening and the first-night walk, the six-room cellar with the Snuffer, the L1 pack actions, and the L2/L3 panels: the Coldfair and anvil, the Noonless Crater scene, and the barn.
- Mon Nov 23 audit fixes ✅: thawed blocks are pristine; barn place/take keeps bound/pristine/demo; craft refunds lost or full-pack rolls; anvil fodder respects `on_the_anvil`; Thawery `sealOk` works after reveal.

## Doing
- A/B: waiting on the student to deploy. Next polish is demo path and art.
- C: asset pipeline. Packs are downloaded.
- D: `economy.json` and codegen. The program is calling the signatures in `progress/D.md`.

## Blocked, or needs the student
- Restart Cursor so its terminals use the new PATH.
- Deploy rent is 7.70 SOL for the current `.so`; aim for ~16 SOL on the admin key (holds rent twice). Has 5 ✅. Not deployed.
- `ER_URL` for the devnet rollup, in `scripts/.env`. The local MagicSVM run does not need it.
- Committed and pushed on the student's request, Sat Nov 21, 7:45 PM IST ✅: six commits on `main` at `https://github.com/KaranSinghBisht/sunhoard` (private). The submission checklist in `blitz/README.md` wants the repo public and accessible; the student flips it before submitting. The L1–L3 work plus this audit are uncommitted until the student approves the next commit.

## Decisions (what changed from docs/, and why)
- See `progress/A.md` and `progress/D.md`. No design number was changed. Villagers stay Wednesday's extra.
- The Vault pays a claim by moving lamports. It is owned by the program, and the system program rejects a transfer from it.
- The season-1 payout account is created by `init_payout`, not `init_game`, so `init_game` stays inside the SBF stack limit.
- Pell's Wants and the bounties are deterministic from the season salt instead of a per-hour VRF request, because the crank cannot request VRF (a HANDOFF.md §9 unknown; the fallback path).
- Bounty claims, more professions, socketing, reforging and rescues are the remaining stretch work.

## Contract changes (IDL, economy.json, logic/ signatures, strings.json keys)
- IDL at `target/idl/sunhoard.json`, copied to `client/src/gen/idl/sunhoard.json`. It lists the M1–L3 instructions through `demo_grant` and does not list `debug_grant` or `debug_kill`.
- `logic` signatures in `progress/D.md`, including `open_room`, `step_fight`, `room_clear`, `step_lair`, `plan_strike`, `tick_world`, and `stone_weapon`.

## ❓ answers (from HANDOFF.md §9)
- Unanswered. They need the devnet TEE. The local MagicSVM run is not that test.

## Test evidence (command and result)
- Mon Nov 23, 12:57 AM IST ✅: `cargo +1.89.0 test --lib` 66 passed; `cargo +1.93.0 test --manifest-path tests-magicsvm-rs/Cargo.toml` 4 passed in 155 s; `corepack yarn typecheck` exit 0; `corepack yarn test` 38 passed. Not deployed.
- Earlier: `anchor build` exit 0, `.so` 1,515,448 bytes (default binary, no debug instructions).
