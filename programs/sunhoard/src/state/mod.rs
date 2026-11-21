//! Account structs. Big ones are zero-copy and stay under 10 KB.
//! Flags are bits, because a zero-copy account cannot hold a bool.

mod arena;
mod bits;
mod chain;
mod item;
mod village;

pub use arena::*;
pub use bits::*;
pub use chain::*;
pub use item::*;
pub use village::*;

#[cfg(test)]
mod tests {
    use super::*;

    fn fits(name: &str, len: usize) {
        let total = 8 + len;
        assert!(
            total < ACCOUNT_LIMIT,
            "{name} is {total} bytes, at or over {ACCOUNT_LIMIT}"
        );
    }

    #[test]
    fn accounts_fit_under_the_cpi_limit() {
        fits("inventory", Inventory::LEN);
        fits("village", Village::LEN);
        fits("arena", Arena::LEN);
        fits("market", Market::LEN);
        fits("season", Season::LEN);
        fits("presence", Presence::LEN);
        fits("world", World::LEN);
        fits("prices", PriceBoard::LEN);
        fits("vault", Vault::LEN);
        fits("payout", Payout::LEN);
        fits("player", Player::LEN);
    }

    #[test]
    fn season_damage_table_starts_at_byte_176() {
        assert_eq!(core::mem::size_of::<DamageSlot>(), 56);
        assert_eq!(core::mem::offset_of!(Season, damage), 176);
    }

    #[test]
    fn listing_drops_only_the_cracking_slot() {
        assert_eq!(core::mem::size_of::<ItemSlot>(), 104);
        assert_eq!(core::mem::size_of::<ListedItem>(), 96);
        assert_eq!(core::mem::size_of::<Listing>(), 152);
        assert_eq!(Market::LEN, 8 + 64 * 152);
    }
}
