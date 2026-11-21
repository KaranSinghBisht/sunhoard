//! Season opening. The HP band is 85% to 115% of the base, sealed in World.

use crate::errors::LogicError;

use super::numbers::{HP_SCALE_MIN_BP, HP_SCALE_SPAN};

pub fn item_id(player_number: u32, counter: u32) -> Result<u64, LogicError> {
    u64::from(player_number)
        .checked_mul(1 << 40)
        .and_then(|base| base.checked_add(u64::from(counter)))
        .ok_or(LogicError::Overflow)
}

pub fn sealed_hp(base: u64, randomness: &[u8; 32]) -> Result<u64, LogicError> {
    let word = u32::from_le_bytes([randomness[0], randomness[1], randomness[2], randomness[3]]);
    let scale = HP_SCALE_MIN_BP
        .checked_add(u64::from(word) % HP_SCALE_SPAN)
        .ok_or(LogicError::Overflow)?;
    base.checked_mul(scale)
        .ok_or(LogicError::Overflow)?
        .checked_div(10_000)
        .ok_or(LogicError::Overflow)
}

#[cfg(test)]
mod tests {
    use super::{item_id, sealed_hp};

    #[test]
    fn item_ids_leave_room_for_the_counter() {
        assert_eq!(item_id(1, 1).unwrap(), (1 << 40) + 1);
        assert!(item_id(u32::MAX, 1).is_err());
    }

    #[test]
    fn hp_stays_inside_the_band() {
        let low = [0u8; 32];
        let mut high = [0u8; 32];
        high[0] = 0xb8;
        high[1] = 0x0b;
        assert_eq!(sealed_hp(66_000, &low).unwrap(), 66_000 * 8_500 / 10_000);
        assert_eq!(sealed_hp(66_000, &high).unwrap(), 66_000 * 11_500 / 10_000);
    }
}
