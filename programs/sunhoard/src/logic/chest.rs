//! The boss chest: the glow tier rolls at the kill, the contents are fixed by it.

use crate::errors::LogicError;

use super::ids::SHELL_BOSS;
use super::numbers::{
    CHESTS_PER_DAY, CHEST_GEAR_PPM, CHEST_GLINT_HUNDREDTHS, CHEST_IRON, CHEST_PPM_DEMO,
    CHEST_PPM_LIVE, CHEST_SHELL_KIND, CHEST_SHELL_PPM,
};
use super::roll::ppm_of;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ChestRoll {
    pub tier: u8,
    pub glints: u64,
    pub gear_rarity: Option<u8>,
    pub shell: Option<u8>,
}

/// One VRF roll picks the glow tier. After the daily cap the tier drops by one.
pub fn roll_chest(randomness: &[u8; 32], demo: bool, chests_today: u8) -> Result<ChestRoll, LogicError> {
    let table = if demo { CHEST_PPM_DEMO } else { CHEST_PPM_LIVE };
    let tier = pick(table, ppm_of(word(randomness, 0)))?;
    let capped = if chests_today >= CHESTS_PER_DAY {
        tier.saturating_sub(1)
    } else {
        tier
    };
    contents(capped, randomness)
}

/// The tier's contents: Glints, gear (iron), and the extra shell.
fn contents(tier: u8, randomness: &[u8; 32]) -> Result<ChestRoll, LogicError> {
    let index = usize::from(tier);
    let glints = CHEST_GLINT_HUNDREDTHS
        .get(index)
        .copied()
        .ok_or(LogicError::BadAmount)?;
    let gear_ppm = CHEST_GEAR_PPM
        .get(index)
        .copied()
        .ok_or(LogicError::BadAmount)?;
    let shell_ppm = CHEST_SHELL_PPM
        .get(index)
        .copied()
        .ok_or(LogicError::BadAmount)?;
    let gear_rarity = if ppm_of(word(randomness, 1)) < gear_ppm {
        Some(tier)
    } else {
        None
    };
    // Iron chests drop Uncommon gear even though their tier id is 1.
    let gear_rarity = gear_rarity.map(|rarity| match rarity {
        CHEST_IRON => 1,
        other => other,
    });
    let shell = if ppm_of(word(randomness, 2)) < shell_ppm {
        Some(CHEST_SHELL_KIND[index])
    } else {
        None
    };
    Ok(ChestRoll {
        tier,
        glints,
        gear_rarity,
        shell,
    })
}

/// The day's first clear also drops a sealed boss block. Its grade odds live
/// in `GRADE_PPM[SHELL_BOSS]`: 70% Dim, 25% Glowing, 5% Bright, thawed free.
pub fn first_clear_block() -> u8 {
    SHELL_BOSS
}

/// The chest's gear is always iron, always a blade or an axe.
pub fn chest_gear_kind(randomness: &[u8; 32]) -> u16 {
    if word(randomness, 4) % 2 == 0 {
        super::ids::GEAR_IRON_SWORD
    } else {
        super::ids::GEAR_IRON_AXE
    }
}

/// The rimeshell the chest drops, by tier. A boss block is its own shell.
pub fn shell_for(tier: u8) -> Result<u8, LogicError> {
    CHEST_SHELL_KIND
        .get(usize::from(tier))
        .copied()
        .ok_or(LogicError::BadAmount)
}

fn pick(table: [u32; 5], roll: u32) -> Result<u8, LogicError> {
    let mut acc = 0u32;
    for (index, weight) in table.iter().enumerate() {
        acc = acc.saturating_add(*weight);
        if roll < acc {
            return Ok(index as u8);
        }
    }
    Err(LogicError::BadAmount)
}

fn word(bytes: &[u8; 32], index: usize) -> u32 {
    let start = index * 4;
    if start + 4 > bytes.len() {
        return 0;
    }
    u32::from_le_bytes([bytes[start], bytes[start + 1], bytes[start + 2], bytes[start + 3]])
}

#[cfg(test)]
mod tests {
    use super::{chest_gear_kind, first_clear_block, roll_chest, shell_for};
    use crate::logic::ids::{GEAR_IRON_AXE, GEAR_IRON_SWORD, SHELL_MEDIUM, SHELL_SMALL};
    use crate::logic::numbers::{CHEST_CRYSTAL, CHEST_SUN, CHEST_WOODEN};

    #[test]
    fn a_high_roll_is_a_sun_chest_and_a_low_roll_is_wooden() {
        let high = [0xffu8; 32];
        let sun = roll_chest(&high, false, 0).unwrap();
        assert_eq!(sun.tier, CHEST_SUN);
        assert_eq!(sun.glints, 5_000);
        assert!(sun.gear_rarity.is_some());
        assert!(sun.shell.is_some());
        assert_eq!(shell_for(sun.tier), Ok(crate::logic::ids::SHELL_LARGE));

        let low = [0u8; 32];
        let wooden = roll_chest(&low, false, 0).unwrap();
        assert_eq!(wooden.tier, CHEST_WOODEN);
        assert_eq!(wooden.glints, 300);
        // Wooden gear is a 30% roll; a zero word lands it.
        assert_eq!(wooden.gear_rarity, Some(0));
        assert_eq!(wooden.shell, None);
    }

    #[test]
    fn the_cap_drops_the_tier_and_a_crystal_chest_drops_a_medium_shell() {
        let mut bytes = [0u8; 32];
        bytes[0] = 0x0b; // Just past the demo wooden+iron bands: silver+ tier.
        let demo = roll_chest(&bytes, true, 0).unwrap();
        let capped = roll_chest(&bytes, true, 6).unwrap();
        assert!(capped.tier <= demo.tier);
        assert_eq!(shell_for(CHEST_CRYSTAL), Ok(SHELL_MEDIUM));
    }

    #[test]
    fn the_first_clear_block_and_chest_gear_are_deterministic() {
        assert_eq!(first_clear_block(), crate::logic::ids::SHELL_BOSS);
        let vrf = [9u8; 32];
        assert!(
            chest_gear_kind(&vrf) == GEAR_IRON_SWORD || chest_gear_kind(&vrf) == GEAR_IRON_AXE
        );
        assert_eq!(shell_for(0), Ok(SHELL_SMALL));
    }
}
