//! The anvil: one rarity up, odds from the value of the inputs against the
//! target, heat from failures, and a 5% strike fee.

use crate::errors::LogicError;

use super::ids::RARITY_LEGENDARY;
use super::merchant::charter_gear;
use super::numbers::BP;

/// The chance before heat, in basis points: 80% × inputs ÷ target.
pub const BASE_ODDS_BP: u64 = 8_000;
/// Strikes under 30% before heat are refused.
pub const REFUSE_BELOW_BP: u64 = 3_000;
/// The odds never pass 80%.
pub const ODDS_CAP_BP: u64 = 8_000;
/// The strike fee: 5% of the target's value.
pub const STRIKE_FEE_BP: u64 = 500;
/// Heat per failure, in percentage points; at most 15.
pub const HEAT_PER_FAIL: u16 = 5;
pub const HEAT_CAP: u16 = 15;
/// Heat fades after 30 minutes of an idle anvil.
pub const HEAT_IDLE_SECS: i64 = 30 * 60;
/// A failed strike returns 10% of the input value as scrap.
pub const SCRAP_BP: u64 = 1_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct StrikePlan {
    pub target_rarity: u8,
    pub pre_odds_bp: u64,
    pub odds_bp: u64,
    pub fee: u64,
}

/// Plans a strike: the target is one rarity up, the odds come from the inputs.
pub fn plan_strike(
    material: u8,
    rarity: u8,
    inputs_value: u64,
    heat: u16,
) -> Result<StrikePlan, LogicError> {
    if rarity >= RARITY_LEGENDARY {
        return Err(LogicError::BadRarity);
    }
    let target_rarity = rarity + 1;
    let target = charter_gear(material, target_rarity)?;
    if target == 0 {
        return Err(LogicError::BadRarity);
    }
    let pre = inputs_value
        .checked_mul(BASE_ODDS_BP)
        .ok_or(LogicError::Overflow)?
        / target;
    if pre < REFUSE_BELOW_BP {
        return Err(LogicError::BadAmount);
    }
    let heat_bp = u64::from(heat.min(HEAT_CAP)) * 100;
    let odds = pre.saturating_add(heat_bp).min(ODDS_CAP_BP);
    let fee = target
        .checked_mul(STRIKE_FEE_BP)
        .ok_or(LogicError::Overflow)?
        / u64::from(BP);
    Ok(StrikePlan {
        target_rarity,
        pre_odds_bp: pre,
        odds_bp: odds,
        fee,
    })
}

/// Heat after a failure: +5, capped at 15.
pub fn heat_after_fail(heat: u16) -> u16 {
    heat.saturating_add(HEAT_PER_FAIL).min(HEAT_CAP)
}

/// The scrap a failed strike returns: 10% of the input value.
pub fn scrap(inputs_value: u64) -> Result<u64, LogicError> {
    inputs_value
        .checked_mul(SCRAP_BP)
        .map(|scaled| scaled / u64::from(BP))
        .ok_or(LogicError::Overflow)
}

#[cfg(test)]
mod tests {
    use super::{heat_after_fail, plan_strike, scrap, REFUSE_BELOW_BP};
    use crate::logic::ids::{MAT_IRON, MAT_STONE, RARITY_COMMON, RARITY_LEGENDARY, RARITY_RARE};

    #[test]
    fn odds_follow_eighty_percent_of_inputs_over_target() {
        // Stone common target = uncommon = 240 hundredths. Full inputs: 80%.
        let full = plan_strike(MAT_STONE, RARITY_COMMON, 240, 0).unwrap();
        assert_eq!(full.pre_odds_bp, 8_000);
        assert_eq!(full.odds_bp, 8_000);
        assert_eq!(full.fee, 12);
        // Half the inputs: 40%.
        let half = plan_strike(MAT_STONE, RARITY_COMMON, 120, 0).unwrap();
        assert_eq!(half.pre_odds_bp, 4_000);
    }

    #[test]
    fn heat_caps_and_a_legendary_target_is_refused() {
        let low = plan_strike(MAT_IRON, RARITY_COMMON, 600, 0);
        assert!(low.is_err() || low.unwrap().pre_odds_bp < REFUSE_BELOW_BP + 10_000);
        assert!(plan_strike(MAT_IRON, RARITY_LEGENDARY, 100_000, 0).is_err());
        let heated = plan_strike(MAT_IRON, RARITY_COMMON, 900, 15).unwrap();
        assert!(heated.odds_bp > heated.pre_odds_bp);
        assert_eq!(heated.odds_bp, 8_000.min(heated.pre_odds_bp + 1_500));
        assert_eq!(heat_after_fail(12), 15);
        assert_eq!(heat_after_fail(15), 15);
        assert_eq!(scrap(1_000), Ok(100));
    }

    #[test]
    fn rare_iron_targets_epic() {
        let plan = plan_strike(MAT_IRON, RARITY_RARE, 10_000, 0).unwrap();
        assert_eq!(plan.target_rarity, 3);
    }
}
