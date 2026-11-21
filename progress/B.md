# Progress
Milestone: M1 client loop · Updated: Sat Nov 21, 6:50 PM IST

## Done
- Vite + React 18 client in `client/`. Phaser 3.90.0 draws a 480×270 meadow. React draws the HUD, the transaction list, the wallet button, and the pack (E).
- Chain layer: base and rollup connections, a cached rollup token (`getAuthToken`, from the private-counter example), the sign-up → delegate → join order, a 12-hour session key in `sessionStorage`, a send queue with a retry and a timeout, account subscriptions, and Explorer links. A rollup link encodes the whole `customUrl`, and that link uses the session key's token.
- A transaction is signed once. A rejected signature is not retried. After a signature exists, the same bytes are resent, and confirmation waits for `confirmed` or `finalized`.
- Movement posts wait at least one second after the first post and never step more than 80 units, including on a diagonal. Zoom changes the Phaser scale and does not rebuild the scene.
- The meadow is a hand-laid 60×40-tile map (960×640 px) in `client/src/game/meadow/`. One road runs west to east past the camp, with a branch north to a cottage and a branch south to two igloos. A frozen pond lies north-west and the cellar cave east. Birchwood closes every side. The camera follows the keeper.
- The ground is drawn from the pack's 47-piece terrain sets, so snow drifts, the dirt road and the pond have proper edges. Each lantern and the camp fire thaws a dithered ring of grass. Every tree, rock, tent and house is one whole sprite, sorted by its foot, with a foot-sized solid.
- Night: the screen is multiplied by a blue shade with a stepped hole at each light. The sky strip has stars, the noon-hole and an aurora. Snow falls across the screen.
- Space works on the nearest thing in reach, and a gold tag names it: chop the birch, knock at the cave (same as the Bramble Cellars button), or Nell.
- Bramble Cellars is redrawn: an earth floor inside a brick wall, two sconces, sprites that face the way they move and glide between steps, health bars, and a swing arc. With no session the button opens a practice room that runs the same step function in the page. It is labelled "Practice room. Nothing here is on chain." and sends nothing.
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
- Thaw sends `crack`, waits for a later slot, then `crack_reveal`. The page checks `sha256(key)` against the commitment it saw before the reveal.
- Bramble Cellars sends `enter_dungeon`, then `arena_input` when the keys change, and `exit_dungeon` on the way out. The page runs the same room step as `logic/fight.rs` and logs how many frames stay inside half a tile.
- Claim sends `claim` on devnet, signed by the wallet.
- `yarn typecheck` passes. Vitest: 20 passed.

## Doing
- A: see `progress/A.md`. Devnet deploy is waiting on the student.
- B: the game is on screen at `http://127.0.0.1:5173/`. No transaction has ever been sent from it: chop, thaw, the chain cellar and claim all need a deployed program and a connected wallet.
- C: art packs are in `assets-src/`. The pipeline is not started. Pixelify Sans is named in CSS and the font file is not bundled yet.
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

## Contract changes (IDL, economy.json, logic/ signatures, strings.json keys)
- `client/src/content/strings.ui.json` keys: `connect`, `enter`, `entering`, `energy`, `glints`, `pot`, `txlog`, `inventory`, `emptyPack`, `filled`, `chop`, `chopped`, `bonus`, `needSession`, `closer`, `signedOut`, `rejected`, `thaw`, `thawed`, `noShell`, `sealOk`, `cellar`, `leave`, `claim`, `claimed`. Added Sat Nov 21 evening: `chopHint`, `doorHint`, `nellHint`, `sealing`, `darkHatch`, `txEmpty`, `txCount`, `txAverage`, `pack`, `gate`, `built`, `keyMove`, `keyMoveDoes`, `keyUse`, `keyUseDoes`, `keyPack`, `keyPackDoes`, `declined`, `noAnswer`, `refused`, `expired`, `pending`, `roomClear`, `fell`, `fightHelp`, `practice`, `practiceNote`, `hp`, `sessionLost`, `sealSlot`. Removed: `moveHelp`, `chopHelp`, `packHelp`. Added 6:30 PM: `nellName`, `nell1`, `nell3`, `loreBlocks`, `loreHoard`, `loreKeeper`, `taleNext`, `talkEnd`, `taleSkip`, `taleAgain`, `questTitle`, `questRoad`, `questNell`, `questCellar`, `questFight`, `questDone`, `questSkip`. Changed: `nellHint`, `keyUseDoes`.
- `strings.json` is still Track C's file and does not exist yet.

## ❓ answers (from HANDOFF.md §9)
- Unanswered. They need the devnet TEE.

## Test evidence (command and result)
- `corepack yarn typecheck` → exit 0, Sat Nov 21, 5:00 AM IST. Node 24.10.0, TypeScript 5.8.3.
- `corepack yarn test` → 13 passed at Sat Nov 21, 5:47 AM IST. The new ones match the Rust room: an 8-unit step, a 24-unit dash, a rat chase to x=24, one iron hit per cooldown, and contact damage once. Vitest 3.2.4.
- Browser, `http://127.0.0.1:5173/`: the dusk meadow, moon, birch, and keeper render. E opens the pack. Bramble Cellars without a wallet shows "Enter the meadow before chopping." Thaw says the pack has no sealed shell. Claim stays disabled until a wallet connects.
- Browser, `http://127.0.0.1:5173/`: the meadow canvas, HUD, transaction panel, and wallet button render. Enter stays disabled until a wallet connects. E opens the pack. Space beside the tree shows "Enter the meadow before chopping."
- Sat Nov 21, 5:47 PM IST ✅ `corepack yarn typecheck` → exit 0. `corepack yarn test` → 5 files, 20 passed. `corepack yarn build` → built; one 2.9 MB chunk (779 kB gzip), with Vite's size warning.
- The 7 new tests in `test/meadow.test.ts`: all 256 neighbour patterns land on 47 distinct terrain pieces; the map is a full 60×40 rectangle; no hand-placed prop or lantern sits in the wood or on the pond; the keeper can walk from the start to within reach of the birch, the cave and Nell; every road tile is reachable; the map edge is closed.
- Sat Nov 21, 5:45 PM IST ✅ Browser, canvas snapshots at `http://127.0.0.1:5173/`: camp with the "Space: chop the birch" tag, the cave with its tag, the title card at 1280×720, the playing layout at 1280×720 and 1440×900, and the practice room with three foes, health bars and the practice label.
- Sat Nov 21, 5:50 PM IST ✅ after the Nell tag change: `corepack yarn typecheck` exit 0, `corepack yarn test` 20 passed; canvas snapshot shows the two-line tag beside Nell.
- Sat Nov 21, 6:30 PM IST ✅ `corepack yarn typecheck` exit 0. `corepack yarn test` → 6 files, 26 passed. `corepack yarn build` built (2.95 MB chunk, 783 kB gzip).
- The 6 new tests in `test/story.test.ts`: each step moves on only for its own event; the road in is clear and every trail, followed dot by dot from the last step's end, stays walkable and ends within 16 px of its goal; every marker and camera spot is on the map; the opening ignores the key press that started it and ends after five lines; the walk holds still during the opening, runs to "done", and can be skipped.
- Sat Nov 21, 6:25 PM IST ✅ Browser at 1280×720 and 1440×900: the opening's lines with the noon ring and the Keeper walking in; one Space event with two repeats moved exactly one line; the trail along the road to the fire and to the cave; Nell's two lines; step 5 in the practice room; "The first night is done" and the saved flag; "Hear the tale again" on the next load.
- Found and fixed while looking: a long HUD note (the practice-room one) stretched the page sideways and pushed the right-hand buttons off the frame.
- Sat Nov 21, 6:50 PM IST ✅ after the text fix: `corepack yarn typecheck` exit 0, `corepack yarn test` 26 passed, `corepack yarn build` built. Browser at 1100×680, 2× pixel density: the tracker reads "The first night" (it read "The Arst night" through the fi ligature), the tag reads "Space: speak to Nell", and each font pixel is exactly 3 screen pixels. Also looked at Nell's box, the cellar line and an opening line.

## Does not work yet
- Nothing is deployed, so no chain path in the page has ever run: enter the meadow, chop, thaw, the chain cellar and claim are untested against a real program. ❓
- Nell says two lines and gives no block. `nell.2`, the bound Dim Dawn block and the lantern post are not built.
- The walk's chop step passes on the key press. With no session nothing is chopped, and the HUD says "Enter the meadow before chopping."
- Reloading mid-walk starts the opening again; only a finished or skipped walk is remembered.
- The trail hugs the road's north edge instead of its middle.
- On a 1× screen the 16.5 px text is 1.5 screen pixels per font pixel, so it is softer there than on a Mac's 2× screen.
- Pixelify Sans's own capital C, B and E are close to O, G and €. That is the font, not the rendering.
- In the narrow layout the right-hand panels still overlap the cellar room's right wall.
- No sound and no music.
- The practice room gives no reward and has no exit other than the Bramble Cellars button.
- In the cellar the keeper is dim under the night shade and the swing arc lasts only a frame or two.
- `strings.json` (Track C) still does not exist; every line on screen comes from `strings.ui.json`.
