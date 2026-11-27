#!/usr/bin/env bash
# Cues for recording the demo video. Devnet only; run from anywhere.
#
#   scripts/record.sh kit <wallet>    devnet SOL now, then the props once that wallet has entered the game
#   scripts/record.sh buy <wallet>    the bot keeper buys that wallet's open Coldfair listing
#   scripts/record.sh fight [secs]    the bot keeper fights Old Gloam beside you (default 45 s)
#   scripts/record.sh soften [secs]   the other bot wears Old Gloam down before a take (default 60 s)
#   scripts/record.sh settle          after the kill: write the SOL split on Solana
#   scripts/record.sh next            open the next season (about 5 minutes after settle), and refill the vault
#   scripts/record.sh status          season, hoard, slayers and total damage
set -euo pipefail

GAME="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_KEY="$HOME/.config/solana/sunhoard-admin.json"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

admin() { (cd "$GAME" && node --experimental-strip-types scripts/admin.ts "$@"); }
bot() { (cd "$GAME/client" && corepack yarn -s live "$@"); }

wallet_arg() {
  if [[ ! "${1:-}" =~ ^[1-9A-HJ-NP-Za-km-z]{32,44}$ ]]; then
    echo "Give your wallet address: click the wallet button in the game, then Copy address." >&2
    exit 1
  fi
}

# Tops the wallet up to play without the public faucet, which often refuses.
top_up() {
  local held
  held="$(solana balance "$1" --url devnet | awk '{print $1}')"
  if awk -v held="$held" 'BEGIN { exit !(held < 0.3) }'; then
    solana transfer "$1" 0.5 --from "$ADMIN_KEY" --fee-payer "$ADMIN_KEY" --url devnet --allow-unfunded-recipient
  fi
  echo "$1 holds $(solana balance "$1" --url devnet)"
}

# A grant lands only once the wallet has entered the game, so the first one is retried for five minutes.
first_grant() {
  local try
  for try in $(seq 1 60); do
    if admin grant "$1" shell 1 >/dev/null 2>&1; then return 0; fi
    if [[ "$try" == 1 ]]; then echo "Now click Enter in the game with this wallet. Waiting for it..."; fi
    sleep 5
  done
  echo "That wallet never entered the game. The grant's own error:" >&2
  admin grant "$1" shell 1
}

kit() {
  wallet_arg "${1:-}"
  top_up "$1"
  first_grant "$1"
  echo "granted: a Small rimeshell (sell it sealed)"
  admin grant "$1" shell 4 >/dev/null && echo "granted: a Crater shell (thaw it: always two blocks, no fee)"
  admin grant "$1" gear 19 4 >/dev/null && echo "granted: the legendary gilded blade (equip it from the pack)"
  local copy
  for copy in 1 2 3 4; do admin grant "$1" gear 16 0 >/dev/null; done
  echo "granted: four common iron swords (sell one to Auntie Pell for Glints, keep three for the anvil)"
  echo "Kit done. Open the pack to see it; every item is labelled a demo grant."
}

case "${1:-}" in
  kit) kit "${2:-}" ;;
  buy)
    wallet_arg "${2:-}"
    LIVE_KEEPER=1 LIVE_FAIR=buy LIVE_SELLER="$2" bot fair
    ;;
  fight) LIVE_KEEPER=2 LIVE_SECONDS="${2:-45}" bot crater ;;
  soften) LIVE_KEEPER=1 LIVE_SECONDS="${2:-60}" bot crater ;;
  settle) admin settle ;;
  next) admin next && admin fund 0.2 ;;
  status) admin status ;;
  [1-9A-HJ-NP-Za-km-z]*)
    # A bare wallet address means the kit.
    wallet_arg "$1"
    kit "$1"
    ;;
  *)
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
