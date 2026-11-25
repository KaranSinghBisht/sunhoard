#!/bin/sh
# Devnet only. The student runs this. It does not touch mainnet.
#
# Rent at the current binary size (about 1.15 MB) is ~8 SOL, and the deploy
# buffer holds that twice at its peak, so the admin key wants ~16 SOL free.
# This script never changes the global `solana config`.
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root"
export PATH="$HOME/.avm/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

admin="$HOME/.config/solana/sunhoard-admin.json"
program_key="$HOME/.config/solana/sunhoard-program.json"

# A clean `target/` would make Anchor mint a new program id, which would orphan
# the client's env and every shared PDA. Restore the pinned keypair first.
mkdir -p target/deploy
if [ ! -f target/deploy/sunhoard-keypair.json ]; then
  cp "$program_key" target/deploy/sunhoard-keypair.json
  chmod 600 target/deploy/sunhoard-keypair.json
fi

echo "admin balance: $(solana balance -k "$admin" --url https://api.devnet.solana.com)"

anchor build
anchor deploy --provider.cluster devnet --provider.wallet "$admin"

echo "deployed the default binary. It does not contain debug_grant or debug_kill."
echo "next: node --experimental-strip-types scripts/init-game.ts"
