#!/bin/sh
# Devnet only. The student runs this. It does not touch mainnet.
#
# Rent at the current binary size (about 1.15 MB) is 5.85 SOL. A first deploy
# holds it in the buffer and then in the program; an upgrade needs 5.85 SOL free
# for the buffer and gets it back.
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

# The public devnet RPC drops a share of the ~1,100 write transactions, so one
# pass rarely finishes. The buffer keypair is kept (gitignored) and every retry
# resumes from it; only the missing chunks are sent again. Works for the first
# deploy and for an upgrade.
mkdir -p .secrets
buffer=.secrets/deploy-buffer.json
if [ ! -f "$buffer" ]; then
  solana-keygen new --no-bip39-passphrase --silent --force -o "$buffer" >/dev/null
  chmod 600 "$buffer"
fi
program_id=$(solana-keygen pubkey "$program_key")
url=https://api.devnet.solana.com

# An upgrade larger than the space the first deploy allocated is refused, so
# grow the program account first when the new binary needs it.
have=$(solana program show "$program_id" --url "$url" 2>/dev/null | awk '/Data Length/ {print $3}' || true)
need=$(wc -c < target/deploy/sunhoard.so | tr -d ' ')
if [ -n "$have" ] && [ "$need" -gt "$have" ]; then
  solana program extend "$program_id" $((need - have + 20480)) --url "$url" -k "$admin"
fi

tries=0
done_ok=0
while [ "$tries" -lt 10 ]; do
  tries=$((tries + 1))
  echo "upload pass $tries"
  out=$(solana program deploy --url "$url" -k "$admin" --fee-payer "$admin" \
    --upgrade-authority "$admin" --buffer "$buffer" --program-id "$program_key" \
    --max-sign-attempts 60 target/deploy/sunhoard.so 2>&1 | grep -E '^Error|^Program Id' || true)
  echo "$out"
  case "$out" in
    *"Program Id"*)
      done_ok=1
      rm -f "$buffer"
      break
      ;;
  esac
  sleep 15
done
if [ "$done_ok" -ne 1 ]; then
  echo "the deploy did not finish in $tries passes; run this script again to resume" >&2
  exit 1
fi

echo "deployed the default binary. It does not contain debug_grant or debug_kill."
echo "next: node --experimental-strip-types scripts/init-game.ts"
