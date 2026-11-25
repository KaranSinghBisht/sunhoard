//! Auntie Pell's prices. Everything is Glint hundredths, integer math only.
//! A Want on the PriceBoard pays +50% while it holds.

use crate::errors::LogicError;

use super::ids::SHELL_BOSS;
use super::numbers::{
    BLOCK_PRICE_BASE_BP, BP, CHARTER_MATERIAL, GEAR_BASE_HUNDREDTHS, GEAR_SHOP_PRICE,
    GRADE_PRICE_HUNDREDTHS, RARITY_PRICE_BP, SHELL_PRICE_HUNDREDTHS, SHOP_PRICE, WANT_BONUS_BP,
};

/// What Pell pays for a material stack of this kind. Errors on gear kinds:
/// gear goes through `charter_gear`, because rarity changes the price.
pub fn charter_material(kind: u16) -> Result<u64, LogicError> {
    for (listed, price) in CHARTER_MATERIAL {
        if listed == kind {
            return Ok(price);
        }
    }
    Err(LogicError::BadNode)
}

/// Pell's shop price for a good she sells.
pub fn shop_price(kind: u16) -> Result<u64, LogicError> {
    for (listed, price) in SHOP_PRICE {
        if listed == kind {
            return Ok(price);
        }
    }
    for (listed, price) in GEAR_SHOP_PRICE {
        if listed == kind {
            return Ok(price);
        }
    }
    Err(LogicError::BadNode)
}

/// The Charter price of a gear item: material base × rarity multiplier.
pub fn charter_gear(material: u8, rarity: u8) -> Result<u64, LogicError> {
    let base = GEAR_BASE_HUNDREDTHS
        .get(usize::from(material))
        .copied()
        .ok_or(LogicError::BadMaterial)?;
    let mult = RARITY_PRICE_BP
        .get(usize::from(rarity))
        .copied()
        .ok_or(LogicError::BadRarity)?;
    base.checked_mul(mult)
        .map(|price| price / u64::from(BP))
        .ok_or(LogicError::Overflow)
}

/// The Charter price of a revealed block: grade × (0.75 + 0.5 × purity).
pub fn charter_block(grade: u8, purity_bp: u16) -> Result<u64, LogicError> {
    let grade_price = GRADE_PRICE_HUNDREDTHS
        .get(usize::from(grade))
        .copied()
        .ok_or(LogicError::BadRarity)?;
    if purity_bp > 10_000 {
        return Err(LogicError::BadAmount);
    }
    let factor = BLOCK_PRICE_BASE_BP
        .checked_add(u64::from(purity_bp) / 2)
        .ok_or(LogicError::Overflow)?;
    grade_price
        .checked_mul(factor)
        .map(|price| price / u64::from(BP))
        .ok_or(LogicError::Overflow)
}

/// What Pell pays for a sealed shell. Crater shells are not for sale.
pub fn charter_shell(shell: u8) -> Result<u64, LogicError> {
    let price = SHELL_PRICE_HUNDREDTHS
        .get(usize::from(shell))
        .copied()
        .ok_or(LogicError::BadShell)?;
    if shell == SHELL_BOSS {
        // The day's first-clear block is bound-free but Pell will not take it
        // for coin before it is thawed: treat it as not for sale sealed.
        return Ok(0);
    }
    if price == 0 && shell == super::ids::SHELL_CRATER {
        return Err(LogicError::BadShell);
    }
    Ok(price)
}

/// The price a good fetches today: the Charter price, plus 50% when Pell Wants it.
fn with_want(base: u64, wanted: bool) -> Result<u64, LogicError> {
    if !wanted {
        return Ok(base);
    }
    let factor = u64::from(BP)
        .checked_add(WANT_BONUS_BP)
        .ok_or(LogicError::Overflow)?;
    base.checked_mul(factor)
        .map(|price| price / u64::from(BP))
        .ok_or(LogicError::Overflow)
}

/// Sell price of a material stack, with the Want bonus.
pub fn sell_material(kind: u16, wanted: bool) -> Result<u64, LogicError> {
    with_want(charter_material(kind)?, wanted)
}

/// Sell price of a gear item, with the Want bonus.
pub fn sell_gear(material: u8, rarity: u8, wanted: bool) -> Result<u64, LogicError> {
    with_want(charter_gear(material, rarity)?, wanted)
}

/// Sell price of a revealed block, with the Want bonus.
pub fn sell_block(grade: u8, purity_bp: u16, wanted: bool) -> Result<u64, LogicError> {
    with_want(charter_block(grade, purity_bp)?, wanted)
}

/// Sell price of a sealed shell, with the Want bonus.
pub fn sell_shell(shell: u8, wanted: bool) -> Result<u64, LogicError> {
    with_want(charter_shell(shell)?, wanted)
}

/// The anvil's fodder value: what Pell would pay, ignoring Wants. Blocks and
/// gear and material stacks all count; shells do not.
pub fn fodder_value(
    kind: u16,
    material: u8,
    rarity: u8,
    grade: u8,
    purity_bp: u16,
    sealed: bool,
    is_block: bool,
) -> Result<u64, LogicError> {
    if sealed {
        return Err(LogicError::BadShell);
    }
    if is_block {
        return charter_block(grade, purity_bp);
    }
    if super::ids::is_gear_kind(kind) {
        return charter_gear(material, rarity);
    }
    charter_material(kind)
}

#[cfg(test)]
mod tests {
    use super::{charter_block, charter_gear, charter_material, charter_shell, shop_price};
    use crate::logic::ids::{
        GEAR_IRON_AXE, GRADE_BLAZING, GRADE_DIM, KIND_BAR, KIND_FOOD, KIND_ORE, KIND_PLANK,
        KIND_SEED, KIND_STONE, KIND_TORCH, KIND_WICKWAX, KIND_WOOD, MAT_GILDED, MAT_IRON,
        MAT_STONE, RARITY_COMMON, RARITY_LEGENDARY, RARITY_RARE, SHELL_CRATER, SHELL_LARGE,
        SHELL_SMALL,
    };

    #[test]
    fn charter_and_shop_tables_match_the_economy_notes() {
        assert_eq!(charter_material(KIND_WOOD), Ok(50));
        assert_eq!(charter_material(KIND_STONE), Ok(40));
        assert_eq!(charter_material(KIND_ORE), Ok(150));
        assert_eq!(charter_material(KIND_PLANK), Ok(25));
        assert_eq!(charter_material(KIND_BAR), Ok(400));
        assert_eq!(charter_material(KIND_TORCH), Ok(10));
        assert_eq!(charter_material(KIND_SEED), Ok(25));
        assert_eq!(charter_material(KIND_WICKWAX), Ok(200));
        assert_eq!(shop_price(KIND_FOOD), Ok(100));
        assert_eq!(shop_price(KIND_BAR), Ok(1_000));
        assert_eq!(shop_price(GEAR_IRON_AXE), Ok(3_500));
        assert!(charter_material(999).is_err());
        assert!(shop_price(999).is_err());
    }

    #[test]
    fn gear_charter_follows_base_times_rarity() {
        assert_eq!(charter_gear(MAT_STONE, RARITY_COMMON), Ok(100));
        assert_eq!(charter_gear(MAT_IRON, RARITY_COMMON), Ok(500));
        assert_eq!(charter_gear(MAT_IRON, RARITY_RARE), Ok(3_000));
        assert_eq!(charter_gear(MAT_GILDED, RARITY_LEGENDARY), Ok(40_000));
    }

    #[test]
    fn blocks_pay_by_grade_and_purity() {
        assert_eq!(charter_block(GRADE_DIM, 10_000), Ok(6_250));
        assert_eq!(charter_block(GRADE_DIM, 0), Ok(3_750));
        assert_eq!(charter_block(GRADE_BLAZING, 0), Ok(60_000));
    }

    #[test]
    fn shells_pay_the_table_and_a_crater_is_not_for_sale() {
        assert_eq!(charter_shell(SHELL_SMALL), Ok(1_000));
        assert_eq!(charter_shell(SHELL_LARGE), Ok(6_000));
        assert!(charter_shell(SHELL_CRATER).is_err());
    }
}
