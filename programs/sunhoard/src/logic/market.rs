//! The Coldfair: fixed-price listings, the 1-Glint deposit, and the 5%
//! Hearth Penny (half rises to the Sunhoard, half is lost to the cold).

use crate::errors::LogicError;

use super::numbers::BP;

/// The listing deposit in Glint hundredths: 1 Glint, burned when unsold.
pub const LISTING_DEPOSIT_HUNDREDTHS: u64 = 100;
/// The Hearth Penny: 5% of the price.
pub const HEARTH_PENNY_BP: u64 = 500;
/// A seller may hold at most this many listings.
pub const LISTINGS_PER_PLAYER: u8 = 10;
/// Listings expire after three days; `tick_world` sweeps them.
pub const LISTING_TTL_SECS: i64 = 3 * 86_400;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FeeSplit {
    pub fee: u64,
    pub pot: u64,
    pub burned: u64,
}

/// Splits the Hearth Penny: 5% of the price, half to the pot, half burned.
pub fn fee_split(price: u64) -> Result<FeeSplit, LogicError> {
    let fee = price
        .checked_mul(HEARTH_PENNY_BP)
        .map(|scaled| scaled / u64::from(BP))
        .ok_or(LogicError::Overflow)?;
    let pot = fee / 2;
    let burned = fee - pot;
    Ok(FeeSplit { fee, pot, burned })
}

/// What the seller receives: the price minus the Hearth Penny.
pub fn seller_receives(price: u64, fee: u64) -> Result<u64, LogicError> {
    price.checked_sub(fee).ok_or(LogicError::BadAmount)
}

/// What the buyer pays: the full price.
pub fn buyer_pays(price: u64) -> Result<u64, LogicError> {
    if price == 0 {
        return Err(LogicError::BadAmount);
    }
    Ok(price)
}

#[cfg(test)]
mod tests {
    use super::{buyer_pays, fee_split, seller_receives, LISTING_DEPOSIT_HUNDREDTHS};

    #[test]
    fn the_penny_splits_five_percent_half_and_half() {
        let split = fee_split(1_000).unwrap();
        assert_eq!(split.fee, 50);
        assert_eq!(split.pot, 25);
        assert_eq!(split.burned, 25);
        assert_eq!(seller_receives(1_000, 50), Ok(950));
        assert_eq!(buyer_pays(1_000), Ok(1_000));
        assert_eq!(buyer_pays(0), Err(crate::errors::LogicError::BadAmount));
        assert_eq!(LISTING_DEPOSIT_HUNDREDTHS, 100);
    }

    #[test]
    fn small_prices_floor_the_fee_without_overflow() {
        let split = fee_split(100).unwrap();
        assert_eq!(split.fee, 5);
        assert_eq!(split.pot, 2);
        assert_eq!(split.burned, 3);
    }
}
