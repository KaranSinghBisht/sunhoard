# Progress
Milestone: audit fixes integrated and live · Updated: Fri Nov 27, 4:30 AM IST

## Audit pass (Thu Nov 26 – Fri Nov 27) ✅
- Codex audited `6c4e967` (68/100) and began fixing every finding; it ran out of quota with the client not
  compiling. Claude reviewed the program diff, finished the client, applied a reviewer agent's findings, and
  upgraded devnet. The findings, what was fixed, how each was verified and what was not are in `../AUDIT.md`.
- Program changes: price-bound `buy_quoted` / `cancel_quoted` and correct slot bounds; seal checked before the thaw
  fee, a refund for a lost seal, a `ThawReceipt` event; raid rows on credited damage, bound to their season;
  `claim_glints` and a kill-time snapshot of the Glint hoard; a claim deadline on the SOL payout; canonical gather
  nodes; the bell's cooldown and nonce; tables generated from `economy/economy.json`. Every new field reuses
  padding, so live accounts kept their layout.
- Contract changes: IDL instructions `buy` → `buy_quoted(listing, revision, expected_price)`, `cancel` →
  `cancel_quoted(listing, revision)`, new `claim_glints(season_number)`, `bell_cb` nonce is now `u64`; `crack` takes
  `world`, `crack_reveal` takes `season`, `start_season` takes `payout`, `exit_dungeon` writes `season`.
  `strings.ui.json` gained 35 keys. `economy/economy.json` and `economy/codegen/generate.py` now exist.
- Test evidence, Fri Nov 27, 4:15 AM IST ✅: `cargo +1.89.0 test --lib` 66 passed; `cargo +1.93.0 test
  --manifest-path tests-magicsvm-rs/Cargo.toml` 5 passed (the fifth smoke-tests the release binary); `corepack yarn
  typecheck` exit 0; `corepack yarn test` 43 passed; `corepack yarn build` built (165 KB first load);
  `python3 economy/codegen/generate.py --check` exit 0. Devnet upgraded at slot 526660185; the live run repeated the
  whole spine, season 2 was killed, settled and claimed in SOL and in Glints, and season 3 is open.
- Does not work yet / not checked ❓: see `../AUDIT.md` §6.

## Earlier: live on devnet, the whole spine proven (Thu Nov 26, 10:55 AM IST)

## Live on devnet (Thu Nov 26) ✅
- Deployed by the Claude session with the student's go-ahead. Program `FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS`,
  upgrade authority the admin key. `init-game.ts` ran: shared accounts created, delegated to the TEE validator,
  permissions set, season 1 open in demo mode. The world clock crank is **not** scheduled on purpose: in demo mode
  it ends the Long Night after 10 minutes. Schedule it only for a recording that wants that.
- Live run with `corepack yarn live <step>` in `client/` (drives the page's own chain code with a throwaway keeper
  whose key is in `.secrets/`): sign-up, both delegations, join, session key, `post_position`, `gather` + VRF
  callback, `merchant_sell`, `equip`, `crack` → `crack_reveal`, `enter_dungeon` + 100 ms crank + `arena_input` +
  `exit_dungeon`, `enter_lair` + crank + `lair_input` + damage flushed to Season + `exit_lair` all landed ✅.
  Round trip is 250–290 ms from India, confirmation polling included.
- Also live ✅ (10:35 AM): a two-wallet Coldfair sale with the fee split, `craft`, an anvil `strike` with its VRF
  roll, a real kill by two keepers, `settle_season` → the Magic Action → the Payout record on Solana → both claims
  (0.04 SOL each), then `admin.ts next` opened season 2. Signatures are in `../SUBMISSION.md`.
- The page itself was driven against devnet with the new guest key: enter, HUD, pack, the chain cellar, Coldfair and
  barn panels ✅. Not run live ❓: Phantom itself, the barn's bell and villagers, the chest after room six, more than
  two players, and the Spring visuals by eye.
- Bugs the live run found, all fixed in the client: the 25 ms status poll got 429 from the public devnet RPC, so
  sign-up never confirmed; every program refusal read "The wallet said no."; **every account decode used the IDL's
  "Player" spelling where Anchor's client wants "player", and the error was swallowed, so the HUD, pack, market and
  fights never updated**; three copies of `wallet-adapter-react` put the wallet modal and the game in different
  contexts, so picking a wallet did nothing; the anvil's fodder was sent as an array where the IDL wants bytes.
- Seasons can restart: `start_season` is allowed again once Old Gloam has fallen (`admin.ts next`). The damage
  table, killer and HP reset, the pot and the wyrm's name carry, and the one payout record is overwritten by the
  next settle. `admin.ts fund <sol>` tops up the vault. MagicSVM `l3` covers a second season.
- Review pass (a separate reviewer agent, 10:50 AM) ✅ fixed: the next season needs `settle` first and the end of Spring
  (5 minutes in demo, a day live), which is the claim window; `record_payout` refuses a season with no kill;
  `admin.ts next` checks the payout is on Solana. Upgraded on devnet and checked: `next` is refused on the open
  season, and a chop still lands. Left as known limits: a shell older than four seasons cannot be thawed and its
  fee is still charged; damage from a visit that straddles a season change lands in the new table.
- `deploy-devnet.sh` now resumes a dropped upload from a kept buffer key and grows the program account when needed.

## ❓ answers (from HANDOFF.md §9) ✅ Thu Nov 26
- VRF works on the TEE validator: `salt_cb` and `gather_cb` arrived within about a second.
- A stranger's token reads World as null; Season is public as designed.
- One 100 ms crank per arena ticks at about 13 steps a second. Several at once is untested.

## Earlier
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
- Deployed Thu Nov 26 ✅. Rent was 5.85 SOL; the admin key holds about 8 SOL.
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


## Test evidence (command and result)
- Thu Nov 26, 10:40 AM IST ✅: `cargo +1.89.0 test --lib` 66 passed; `cargo +1.93.0 test --manifest-path
  tests-magicsvm-rs/Cargo.toml` 4 passed (`l3` now opens a second season); `corepack yarn typecheck` exit 0;
  `corepack yarn test` 41 passed; `corepack yarn build` built. Deployed and upgraded on devnet; `.so` 1,151,560 bytes
  in a 1,171,000-byte program account.
- Mon Nov 23, 12:57 AM IST ✅: `cargo +1.89.0 test --lib` 66 passed; `cargo +1.93.0 test --manifest-path tests-magicsvm-rs/Cargo.toml` 4 passed in 155 s; `corepack yarn typecheck` exit 0; `corepack yarn test` 38 passed. Not deployed.
- Earlier: `anchor build` exit 0, `.so` 1,515,448 bytes (default binary, no debug instructions).
