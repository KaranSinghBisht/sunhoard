#!/bin/sh
# Devnet only. The student runs this. It does not touch mainnet.
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root"
export PATH="$HOME/.avm/bin:$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana config set --url https://api.devnet.solana.com --keypair "$HOME/.config/solana/sunhoard-admin.json"
anchor build
anchor deploy --provider.cluster devnet --provider.wallet "$HOME/.config/solana/sunhoard-admin.json"
echo "deployed the default binary. It does not contain debug_grant or debug_kill."
