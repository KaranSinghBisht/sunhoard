# Sunhoard

A 2D pixel RPG on MagicBlock's Ephemeral Rollups. Devnet only. No real money.

The design lives outside this repo, in the parent `docs/` folder. This repository is the build.

## Why MagicBlock

| What the game does | What runs it |
|---|---|
| Sign-up and the SOL claim | Solana devnet |
| Chopping, thawing, and the cellar, with no wallet popup after the session | The private ephemeral rollup |
| Sealed shells and Old Gloam's world | Private accounts. A non-member cannot read World |
| Aberration rolls and room seeds | VRF |
| The cellar monster | A 100 ms crank |
| The Sunhoard split | A Magic Action that writes the payout back on Solana |

## Run the client

From `client/`, with Node 24:

```sh
corepack yarn
corepack yarn dev
```

Open `http://127.0.0.1:5173/`. Connect a devnet wallet. The meadow, the thaw, the cellar, and the claim button are in the page. They land only after the program is deployed and the season is started.

## Run the tests

From this folder:

```sh
cargo +1.89.0 test --lib
cargo +1.93.0 test --manifest-path tests-magicsvm-rs/Cargo.toml
cd client && corepack yarn test
```

`anchor build` needs Anchor CLI 1.0.2. The program id is `FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS`.

The student deploys. The command is `scripts/deploy-devnet.sh`, then `scripts/init-game.ts` with `ER_URL` set. This checkout has not been deployed.
