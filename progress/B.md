# Progress
Milestone: L2/L3 client panels land · Updated: Mon Nov 23, 12:57 AM IST

## Done
- Vite + React 18 client in `client/`. Phaser 3.90.0 draws a 480×270 meadow. React draws the HUD, the transaction list, the wallet button, and the pack (E).
- Chain layer: base and rollup connections, a cached rollup token (`getAuthToken`, from the private-counter example), the sign-up → delegate → join order, a 12-hour session key in `sessionStorage`, a send queue with a retry and a timeout, account subscriptions, and Explorer links. A rollup link encodes the whole `customUrl`, and that link uses the session key's token.
- A transaction is signed once. A rejected signature is not retried. After a signature exists, the same bytes are resent, and confirmation waits for `confirmed` or `finalized`.
- Movement posts wait at least one second after the first post and never step more than 80 units, including on a diagonal. Zoom changes the Phaser scale and does not rebuild the scene.
- The meadow is a hand-laid 60×40-tile map (960×640 px) in `client/src/game/meadow/`. One road runs west to east past the camp, with a branch north to a cottage and a branch south to two igloos. A frozen pond lies north-west and the cellar cave east. Birchwood closes every side. The camera follows the keeper.
- The ground is drawn from the pack's 47-piece terrain sets, so snow drifts, the dirt road and the pond have proper edges. Each lantern and the camp fire thaws a dithered ring of grass. Every tree, rock, tent and house is one whole sprite, sorted by its foot, with a foot-sized solid.
- Night: the screen is multiplied by a blue shade with a stepped hole at each light. The sky strip has stars, the noon-hole and an aurora. Snow falls across the screen.
- Space works on the nearest thing in reach, and a gold tag names it: chop the birch, knock at the cave (same as the Bramble Cellars button), or Nell.
- Bramble Cellars is redrawn: an earth floor inside a brick wall, two sconces, sprites that face the way they move and glide between steps, health bars, a swing arc, the Snuffer's projectiles, and a red telegraph glow on the boss. With no session the button opens a practice room that runs the same step function in the page. It is labelled "Practice room. Nothing here is on chain." and sends nothing.
- The first screen is a title card over the live meadow, with the camera drifting round the camp: four lines of the tale, the three keys, and "Walk into the Vale". The meadow stays mounted behind it, so opening "The tale" again loses no session or position.
- The opening (`client/src/game/story/`, `ui/Cinema.tsx`): on a first visit "Walk into the Vale" plays five lines of the tale while the camera glides from the pond to the cottage, the igloos, the camp fire and the west road, where the Keeper walks in. A ring marks the noon-hole on its line. Space, Enter or a click moves on, each line moves on by itself after 7 s, and Skip or Esc ends it.
- The first night (`story/quest.ts`, `ui/Quest.tsx`): five steps in a tracker at the canvas's top-left. Walk to the fire, chop the birch, speak to Nell, follow the road to the cave, clear the room. A trail of gold dots runs along the walkable way to the current step and a gold arrowhead bobs over it. The trail keeps to the road where it can.
- Nell speaks: Space beside her opens a box with her face and `nell.1` then `nell.3` from STORY.md §7.
- A browser that has finished or skipped the walk goes straight to the camp. Its title card has "Hear the tale again", which replays the opening and the walk.
- Text: no words are drawn inside the canvas any more. The tag over a usable thing and the line under the cellar fight are page elements laid over the canvas (`game/labels.ts`, `ui/Labels.tsx`), so they render at screen resolution. `meadow/hint.ts` is deleted.
- Type: Pixelify Sans is drawn 11 pixels to the em ✅ (measured from the font's outlines: stems sit about 91 units apart at 1000 units per em). All UI text is now 16.5 px or 22 px, regular weight, with ligatures off. Side panels are 240 px wide.
- Layout: the 480×270 canvas scales by whole numbers to fit the window. On a wide window the rollup feed sits left and the cellar, claim, pack and thaw panels sit right. On a narrow one they overlay the canvas corners. Checked at 1440×900 and 1280×720.
- The rollup feed counts landed transactions and shows each one's milliseconds and Explorer link.
- A failed transaction shows the program's own message or a short plain line. It never shows an address, a hex code or a stack trace.
- The meadow and the panels use the Ninja Adventure sheets and Pixelify Sans. The copies live in `client/public/assets/vendor/`.
- Thaw sends `crack`, waits for a later slot, then `crack_reveal`. The page checks `sha256(key)` against the commitment it saw before the reveal. A shell left cracking after a failed reveal now shows "Reveal", which sends only `crack_reveal`, so a stuck shell is no longer lost.
- Bramble Cellars sends `enter_dungeon`, then `arena_input` when the keys change, `next_room` when a cleared room has another behind it, and `exit_dungeon` on the way out. The page runs the same room step as `logic/fight.rs` and logs how many frames stay inside half a tile.
- The pack (E) now lists every slot with its name, rarity and traits, with Eat, Equip and Sell actions; the workbench lists the twelve recipes and Auntie Pell her shop goods. All of it lands as `craft`, `merchant_sell`, `merchant_buy`, `eat` and `equip` transactions.
- Claim sends `claim` on devnet, signed by the wallet.
- The Coldfair panel lists every Market listing with its price, item and Buy/Take-back actions, and lists any pack slot at a fixed price. The anvil section picks a gear piece, ticks fodder slots, takes Glints, shows the live odds and fee (the same math as `logic/anvil.rs`), and sends `strike`.
- The Noonless Crater (`LairScene`): the keeper steps in, the Glare runs on chain, and the scene predicts the visit with `shared/lair.ts`, the mirror of `logic/lair.rs` — the three phases, the breath, hail, beams, tail sweeps, dashes and sunbursts, the four lantern circles, darkness, sparks and the mark. A "Catch the spark" button appears when a spark is in reach.
- The Barn panel shows the warmth, beds and workstations, each lantern post with its block and Take-back, the villagers (wanderers get Recruit), the Hearth Bell, Collect and Feed.
- The fight mirror now carries the weapon (material, rarity, Keen, Brutal), so the cellar and Crater predictions match the chain's damage numbers for geared keepers.
- `yarn typecheck` passes. Vitest: 33 passed. `yarn build` builds.

## Doing
- A: see `progress/A.md`. Devnet deploy is waiting on the student.
- B: L2 client (market, anvil, lair scene) and L3 (barn, lantern posts, demo).
- C: art packs are in `assets-src/`. The pipeline is not started. Pixelify Sans is named in CSS and the font file is bundled.
- D: see `progress/D.md`.

## Blocked, or needs the student
- Connect a devnet wallet in the browser, then run `scripts/deploy-devnet.sh` and `scripts/init-game.ts` (with `ER_URL`) before the meadow button can land a transaction.
- The dev server is running. Restart it with `corepack yarn dev` from `client/` if it stops.

## Decisions (what changed from docs/, and why)
- Yarn resolutions pin `@coral-xyz/anchor` to 0.32.1 and `@solana/web3.js` to 1.98.4. `gum-sdk` 3.0.10 asks for Anchor 0.30, and the rollup SDK brought its own web3.js. One copy of each is what HANDOFF.md §3 says to do when they clash.
- The meadow is zone 0, matching HANDOFF.md §5. The tree is node 0, at (376, 240) on the map. The MagicSVM test still posts zone 1 on purpose, because that is a zone change from the default.
- The road and each lantern show thawed grass in the winter map. GAME.md's thaw is a late-game event; here it is only lighting, and nothing in the program reads it. ⚠️ Say if the road should stay snow.
- The opening and the first-night walk are new and not in HANDOFF.md; the student asked for them on Sat Nov 21. The walk follows STORY.md §3.2 as far as the build goes: there is no barn, hearth or lantern post to set a block in, so those beats are left out and Nell stands at the camp fire.
- Three lines of the opening are written from STORY.md §3.1 and are not in its §7 table: `loreBlocks`, `loreHoard`, `loreKeeper`. ⚠️ Track C should move them, with the quest lines, into `strings.json` when that file exists.
- UI text uses only the regular weight, except the title. The font's bold is not on the pixel grid and its letters close up at these sizes. Headings are set apart by colour.
- Whether the walk has been done is kept in `localStorage` under `sunhoard.firstNight`. It holds "1" and nothing else.
- The practice room is new and not in HANDOFF.md. It exists so a judge without a wallet can still see the fight. It awards nothing.
- The session signer is a random key kept in `sessionStorage` for 12 hours. It is not derived from the wallet address.
- The pack panel shows the L1 actions: Eat on meals, Equip on gear, Sell on anything not bound, plus the workbench recipes and Pell's counter. Item and trait names live in `strings.ui.json` until Track C's `strings.json` exists.
- The cellar button reads the cleared flag from the fight feed: "Next room" advances mid-run, "Leave the cellar" banks after room six.

## Contract changes (IDL, economy.json, logic/ signatures, strings.json keys)
- `client/src/content/strings.ui.json` keys: `connect`, `enter`, `entering`, `energy`, `glints`, `pot`, `txlog`, `inventory`, `emptyPack`, `filled`, `chop`, `chopped`, `bonus`, `needSession`, `closer`, `signedOut`, `rejected`, `thaw`, `reveal`, `thawed`, `noShell`, `sealOk`, `cellar`, `nextRoom`, `leave`, `claim`, `claimed`. Added Sat Nov 21 evening: `chopHint`, `doorHint`, `nellHint`, `sealing`, `darkHatch`, `txEmpty`, `txCount`, `txAverage`, `pack`, `gate`, `built`, `keyMove`, `keyMoveDoes`, `keyUse`, `keyUseDoes`, `keyPack`, `keyPackDoes`, `declined`, `noAnswer`, `refused`, `expired`, `pending`, `roomClear`, `fell`, `fightHelp`, `practice`, `practiceNote`, `hp`, `sessionLost`, `sealSlot`. Removed: `moveHelp`, `chopHelp`, `packHelp`. Added 6:30 PM: `nellName`, `nell1`, `nell3`, `loreBlocks`, `loreHoard`, `loreKeeper`, `taleNext`, `talkEnd`, `taleSkip`, `taleAgain`, `questTitle`, `questRoad`, `questNell`, `questCellar`, `questFight`, `questDone`, `questSkip`. Changed: `nellHint`, `keyUseDoes`. Added 9:50 PM: `workbench`, `pell`, `buy`, `craft`, `sell`, `equip`, `eat`, `equipped`, the kind, gear, tone, grade, rarity, trait and shell names, and the recipe names.
- `strings.json` is still Track C's file and does not exist yet.

## ❓ answers (from HANDOFF.md §9)
- Unanswered. They need the devnet TEE.

## Test evidence (command and result)
- `corepack yarn typecheck` → exit 0, Sun Nov 22, 12:40 AM IST. Node 24.10.0, TypeScript 5.8.3.
- `corepack yarn test` → 7 files, 33 passed at Sun Nov 22, 12:40 AM IST. The fight mirror matches the Rust room, and the new lair tests mirror the Rust lair tests: the phases end the visit, a marked keeper hits ×1.5, lanterns guard the light, the tenth Gloaming hit spills a scoopable spark, and a gilded legendary blade deals 28 or 42. Vitest 3.2.4.
- `corepack yarn build` → built in 4.69 s.
- Sat Nov 21, 5:48 PM IST ✅ re-run after the client rework: `cargo +1.89.0 test --lib` 36 passed; `cargo +1.93.0 test --manifest-path tests-magicsvm-rs/Cargo.toml` 1 passed in 0.57s; `corepack yarn typecheck` exit 0; `corepack yarn test` 20 passed; `corepack yarn build` built. `anchor build` was not re-run: no program file changed.
- Sat Nov 21, 6:30 PM IST ✅ after the opening and the first-night walk: `corepack yarn typecheck` exit 0; `corepack yarn test` 26 passed; `corepack yarn build` built. No program file changed, so the Rust tests were not re-run.
- Sat Nov 21, 6:50 PM IST ✅ after the text-readability fix in the client: `corepack yarn typecheck` exit 0; `corepack yarn test` 26 passed; `corepack yarn build` built.
- Sat Nov 21, 9:50 PM IST ✅ after the L1 client: `corepack yarn typecheck` exit 0; `corepack yarn test` 27 passed.
- Sun Nov 22, 12:40 AM IST ✅ after the L2/L3 panels: `corepack yarn typecheck` exit 0; `corepack yarn test` 33 passed; `corepack yarn build` built.
- Mon Nov 23, 12:57 AM IST ✅ after the thaw-verify fix: `corepack yarn typecheck` exit 0; `corepack yarn test` 38 passed. The Thawery now pulls the inventory after `crack_reveal` and sets `sealOk` from `sha256(key) == commitment`, because a revealed gem leaves the sealed-shell list.

## Does not work yet
- Nothing is deployed, so no chain path in the page has ever run: enter the meadow, chop, thaw, craft, buy, sell, the chain cellar, the Crater and claim are untested against a real program. ❓
- Nell says two lines and gives no block in the UI. `nell.2` and the lantern-post hand-off are not built.
- The walk's chop step passes on the key press. With no session nothing is chopped, and the HUD says "Enter the meadow before chopping."
- Reloading mid-walk starts the opening again; only a finished or skipped walk is remembered.
- The trail hugs the road's north edge instead of its middle.
- On a 1× screen the 16.5 px text is 1.5 screen pixels per font pixel, so it is softer there than on a Mac's 2× screen.
- Pixelify Sans's own capital C, B and E are close to O, G and €. That is the font, not the rendering.
- In the narrow layout the right-hand panels still overlap the cellar room's right wall.
- No sound and no music.
- The practice room gives no reward and has no exit other than the Bramble Cellars button.
- In the cellar the keeper is dim under the night shade.
- Old Gloam's coil is drawn as a scaled, tinted bat until Track C draws the real wyrm; the Crater room reuses the dungeon floor tiles.
- `strings.json` (Track C) still does not exist; every line on screen comes from `strings.ui.json`.
