use crate::errors::LogicError;

use super::numbers::{BP, CRIT_BP, CRIT_PPM, PPM, RARITY_DAMAGE_BP, WEAPON_BASE};
use super::roll::{expand_hit, ppm_of};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Weapon {
    pub material: u8,
    pub rarity: u8,
    pub keen_ppm: u32,
    pub brutal_bp: u32,
}

pub fn hit_damage(material: u8, rarity: u8) -> Result<u16, LogicError> {
    let base = WEAPON_BASE
        .get(usize::from(material))
        .copied()
        .ok_or(LogicError::BadMaterial)?;
    let mult = RARITY_DAMAGE_BP
        .get(usize::from(rarity))
        .copied()
        .ok_or(LogicError::BadRarity)?;
    let dealt = u64::from(base) * u64::from(mult) / u64::from(BP);
    u16::try_from(dealt).map_err(|_| LogicError::Overflow)
}

pub fn attack_damage(
    weapon: &Weapon,
    seed: &[u8; 32],
    step: u64,
    hit: u16,
) -> Result<i32, LogicError> {
    let base = u32::from(hit_damage(weapon.material, weapon.rarity)?);
    let roll = ppm_of(word0(&expand_hit(seed, step, hit)));
    let chance = CRIT_PPM.saturating_add(weapon.keen_ppm).min(PPM);
    if roll >= chance {
        return i32::try_from(base).map_err(|_| LogicError::Overflow);
    }
    let mult = u64::from(
        CRIT_BP
            .checked_add(weapon.brutal_bp)
            .ok_or(LogicError::Overflow)?,
    );
    let dealt = u64::from(base)
        .checked_mul(mult)
        .ok_or(LogicError::Overflow)?
        / u64::from(BP);
    i32::try_from(dealt).map_err(|_| LogicError::Overflow)
}

fn word0(bytes: &[u8; 32]) -> u32 {
    u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
}

#[cfg(test)]
mod tests {
    use super::{attack_damage, hit_damage, Weapon};
    use crate::logic::ids::{
        MAT_GILDED, MAT_IRON, MAT_STONE, RARITY_COMMON, RARITY_LEGENDARY, RARITY_RARE,
    };

    #[test]
    fn damage_table_matches_the_economy_notes() {
        let stone = [6u16, 6, 7, 9, 10];
        let iron = [10u16, 11, 13, 15, 17];
        let gilded = [16u16, 18, 20, 24, 28];
        for rarity in 0..5 {
            assert_eq!(
                hit_damage(MAT_STONE, rarity).unwrap(),
                stone[usize::from(rarity)]
            );
            assert_eq!(
                hit_damage(MAT_IRON, rarity).unwrap(),
                iron[usize::from(rarity)]
            );
            assert_eq!(
                hit_damage(MAT_GILDED, rarity).unwrap(),
                gilded[usize::from(rarity)]
            );
        }
        assert!(hit_damage(9, RARITY_COMMON).is_err());
        assert!(hit_damage(MAT_IRON, 9).is_err());
    }

    #[test]
    fn a_crit_deals_one_and_a_half_and_a_normal_hit_does_not() {
        let weapon = Weapon {
            material: MAT_IRON,
            rarity: RARITY_COMMON,
            keen_ppm: 0,
            brutal_bp: 0,
        };
        let mut seed = [0u8; 32];
        let mut normal = None;
        let mut crit = None;
        for n in 0..80u8 {
            seed[0] = n;
            let dealt = attack_damage(&weapon, &seed, 0, 0).unwrap();
            if dealt == 10 {
                normal = Some(seed);
            } else if dealt == 15 {
                crit = Some(seed);
            }
        }
        assert!(normal.is_some());
        assert!(crit.is_some());
        let rare = hit_damage(MAT_IRON, RARITY_RARE).unwrap();
        assert_eq!(rare, 13);
        let legendary = hit_damage(MAT_STONE, RARITY_LEGENDARY).unwrap();
        assert_eq!(legendary, 10);
    }
}
