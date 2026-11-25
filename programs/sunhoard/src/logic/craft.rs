//! Crafting recipes. Material recipes pay out at once; gear recipes roll
//! rarity and traits from one VRF callback.

use crate::errors::LogicError;

use super::ids::{
    GEAR_GILDED_AXE, GEAR_GILDED_BLADE, GEAR_GILDED_PICKAXE, GEAR_IRON_AXE, GEAR_IRON_PICKAXE,
    GEAR_IRON_SWORD, GEAR_STONE_AXE, GEAR_STONE_PICKAXE, KIND_BAR, KIND_COAL, KIND_FOOD,
    KIND_MEAL, KIND_ORE, KIND_PLANK, KIND_STONE, KIND_TORCH, KIND_WICKWAX, KIND_WOOD, MAT_GILDED,
    MAT_IRON, MAT_STONE, TRAIT_BOUNTIFUL, TRAIT_BRITTLE, TRAIT_BRUTAL, TRAIT_CLEAVE, TRAIT_CURSED,
    TRAIT_DULL, TRAIT_EFFICIENT, TRAIT_HEAVY, TRAIT_KEEN, TRAIT_PROSPECTOR, TRAIT_SWIFT,
};
use super::numbers::{
    FLAW_PPM, GEAR_RARITY_PPM_GILDED, GEAR_RARITY_PPM_STONE, RARITY_SLOTS, RARITY_TIER_RANGE,
    RECIPE_BAR, RECIPE_BED, RECIPE_COUNT, RECIPE_GILDED_AXE, RECIPE_GILDED_BLADE,
    RECIPE_GILDED_PICKAXE, RECIPE_IRON_AXE, RECIPE_IRON_PICKAXE, RECIPE_IRON_SWORD, RECIPE_MEAL,
    RECIPE_PLANKS, RECIPE_POST, RECIPE_STONE_AXE, RECIPE_STONE_PICKAXE, RECIPE_TORCH,
    RECIPE_WORKSTATION,
};
use super::roll::{expand, ppm_of};

pub const MAX_INGREDIENTS: usize = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ingredient {
    pub kind: u16,
    pub qty: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Recipe {
    pub id: u8,
    /// 0 for a material recipe; the gear kind otherwise.
    pub gear_kind: u16,
    pub material: u8,
    pub ingredients: [Ingredient; MAX_INGREDIENTS],
    pub ingredient_count: u8,
    /// Output quantity for a material recipe; always 1 for gear.
    pub output_kind: u16,
    pub output_qty: u16,
}

fn recipe(
    id: u8,
    gear_kind: u16,
    material: u8,
    output_kind: u16,
    output_qty: u16,
    ingredients: &[(u16, u16)],
) -> Recipe {
    let mut list = [Ingredient { kind: 0, qty: 0 }; MAX_INGREDIENTS];
    let mut count = 0;
    for (index, (kind, qty)) in ingredients.iter().enumerate() {
        list[index] = Ingredient {
            kind: *kind,
            qty: *qty,
        };
        count += 1;
    }
    Recipe {
        id,
        gear_kind,
        material,
        ingredients: list,
        ingredient_count: count,
        output_kind,
        output_qty,
    }
}

pub fn recipes() -> [Recipe; RECIPE_COUNT as usize] {
    [
        recipe(RECIPE_PLANKS, 0, 0, KIND_PLANK, 2, &[(KIND_WOOD, 1)]),
        recipe(
            RECIPE_BAR,
            0,
            0,
            KIND_BAR,
            1,
            &[(KIND_ORE, 3), (KIND_COAL, 1)],
        ),
        recipe(
            RECIPE_MEAL,
            0,
            0,
            KIND_MEAL,
            1,
            &[(KIND_FOOD, 3), (KIND_COAL, 1)],
        ),
        recipe(
            RECIPE_TORCH,
            0,
            0,
            KIND_TORCH,
            4,
            &[(KIND_PLANK, 1), (KIND_COAL, 1)],
        ),
        recipe(
            RECIPE_STONE_AXE,
            GEAR_STONE_AXE,
            MAT_STONE,
            0,
            1,
            &[(KIND_PLANK, 2), (KIND_STONE, 4)],
        ),
        recipe(
            RECIPE_STONE_PICKAXE,
            GEAR_STONE_PICKAXE,
            MAT_STONE,
            0,
            1,
            &[(KIND_PLANK, 2), (KIND_STONE, 4)],
        ),
        recipe(
            RECIPE_IRON_AXE,
            GEAR_IRON_AXE,
            MAT_IRON,
            0,
            1,
            &[(KIND_BAR, 4), (KIND_PLANK, 2)],
        ),
        recipe(
            RECIPE_IRON_PICKAXE,
            GEAR_IRON_PICKAXE,
            MAT_IRON,
            0,
            1,
            &[(KIND_BAR, 4), (KIND_PLANK, 2)],
        ),
        recipe(
            RECIPE_IRON_SWORD,
            GEAR_IRON_SWORD,
            MAT_IRON,
            0,
            1,
            &[(KIND_BAR, 4), (KIND_PLANK, 2)],
        ),
        recipe(
            RECIPE_GILDED_AXE,
            GEAR_GILDED_AXE,
            MAT_GILDED,
            0,
            1,
            &[(KIND_BAR, 5), (KIND_WICKWAX, 4)],
        ),
        recipe(
            RECIPE_GILDED_PICKAXE,
            GEAR_GILDED_PICKAXE,
            MAT_GILDED,
            0,
            1,
            &[(KIND_BAR, 5), (KIND_WICKWAX, 4)],
        ),
        recipe(
            RECIPE_GILDED_BLADE,
            GEAR_GILDED_BLADE,
            MAT_GILDED,
            0,
            1,
            &[(KIND_BAR, 5), (KIND_WICKWAX, 4)],
        ),
        recipe(
            RECIPE_POST,
            0,
            0,
            0,
            0,
            &[(KIND_PLANK, 6), (KIND_BAR, 1)],
        ),
        recipe(
            RECIPE_BED,
            0,
            0,
            0,
            0,
            &[(KIND_PLANK, 10), (KIND_FOOD, 2)],
        ),
        recipe(
            RECIPE_WORKSTATION,
            0,
            0,
            0,
            0,
            &[(KIND_PLANK, 8), (KIND_BAR, 1)],
        ),
    ]
}

pub fn recipe_by_id(id: u8) -> Result<Recipe, LogicError> {
    let found = recipes()
        .into_iter()
        .find(|listed| listed.id == id)
        .ok_or(LogicError::BadNode)?;
    Ok(found)
}
/// True when this recipe makes a gear item and needs the VRF rarity roll.
pub fn is_gear_recipe(recipe: &Recipe) -> bool {
    recipe.gear_kind != 0
}

/// One roll picks the rarity. The gear kind picks the odds table.
pub fn roll_rarity(gear_kind: u16, randomness: &[u8; 32]) -> Result<u8, LogicError> {
    let gilded = matches!(
        gear_kind,
        GEAR_GILDED_AXE | GEAR_GILDED_PICKAXE | GEAR_GILDED_BLADE
    );
    let table = if gilded {
        GEAR_RARITY_PPM_GILDED
    } else {
        GEAR_RARITY_PPM_STONE
    };
    pick(table, ppm_of(word(randomness, 0)))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TraitRoll {
    pub id: u8,
    pub tier: u8,
}

/// Rolls the trait slots for one crafted item. Deterministic from the VRF bytes.
pub fn roll_traits(
    gear_kind: u16,
    rarity: u8,
    randomness: &[u8; 32],
) -> Result<[TraitRoll; 4], LogicError> {
    let slots = RARITY_SLOTS
        .get(usize::from(rarity))
        .copied()
        .ok_or(LogicError::BadRarity)?;
    let (low, high) = RARITY_TIER_RANGE
        .get(usize::from(rarity))
        .copied()
        .ok_or(LogicError::BadRarity)?;
    let flaw = FLAW_PPM
        .get(usize::from(rarity))
        .copied()
        .ok_or(LogicError::BadRarity)?;
    let mut traits = [TraitRoll { id: 0, tier: 0 }; 4];
    for slot in 0..usize::from(slots) {
        let flaw_roll = ppm_of(word(&expand(randomness, 1 + slot as u64), 0));
        if flaw_roll < flaw {
            let id = if is_tool(gear_kind) {
                if flaw_roll % 2 == 0 {
                    TRAIT_BRITTLE
                } else {
                    TRAIT_HEAVY
                }
            } else if flaw_roll % 2 == 0 {
                TRAIT_DULL
            } else {
                TRAIT_CURSED
            };
            traits[slot] = TraitRoll { id, tier: 1 };
            continue;
        }
        let pool: &[u8] = if is_tool(gear_kind) {
            &[
                TRAIT_EFFICIENT,
                TRAIT_BOUNTIFUL,
                TRAIT_PROSPECTOR,
                TRAIT_CLEAVE,
                TRAIT_SWIFT,
            ]
        } else {
            &[
                TRAIT_KEEN,
                TRAIT_BRUTAL,
                TRAIT_PROSPECTOR,
                TRAIT_CLEAVE,
                TRAIT_SWIFT,
            ]
        };
        let id = pool[(word(&expand(randomness, 2 + slot as u64), 0) % 5) as usize];
        let span = u32::from(high) - u32::from(low) + 1;
        let tier = low + (word(&expand(randomness, 3 + slot as u64), 0) % span) as u8;
        traits[slot] = TraitRoll { id, tier };
    }
    Ok(traits)
}

fn is_tool(gear_kind: u16) -> bool {
    matches!(
        gear_kind,
        GEAR_STONE_AXE
            | GEAR_STONE_PICKAXE
            | GEAR_IRON_AXE
            | GEAR_IRON_PICKAXE
            | GEAR_GILDED_AXE
            | GEAR_GILDED_PICKAXE
    )
}

fn pick(table: [u32; 5], roll: u32) -> Result<u8, LogicError> {
    let mut acc = 0u32;
    for (index, weight) in table.iter().enumerate() {
        acc = acc.saturating_add(*weight);
        if roll < acc {
            return Ok(index as u8);
        }
    }
    Err(LogicError::BadRarity)
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
    use super::{is_gear_recipe, recipes, roll_rarity, roll_traits};
    use crate::logic::ids::{
        GEAR_GILDED_BLADE, GEAR_IRON_AXE, KIND_BAR, KIND_PLANK, KIND_WOOD, RARITY_COMMON,
        RARITY_LEGENDARY,
    };

    #[test]
    fn the_tables_match_the_economy_notes() {
        let planks = recipes()[0];
        assert_eq!(planks.ingredients[0].kind, KIND_WOOD);
        assert_eq!(planks.ingredients[0].qty, 1);
        assert_eq!(planks.output_kind, KIND_PLANK);
        assert_eq!(planks.output_qty, 2);
        assert!(!is_gear_recipe(&planks));

        let axe = recipes().into_iter().find(|r| r.gear_kind == GEAR_IRON_AXE).unwrap();
        assert_eq!(axe.ingredients[0].kind, KIND_BAR);
        assert_eq!(axe.ingredients[0].qty, 4);
        assert_eq!(axe.ingredients[1].kind, KIND_PLANK);
        assert!(is_gear_recipe(&axe));
    }

    #[test]
    fn rarity_rolls_stay_in_band() {
        let mut low = [0u8; 32];
        assert_eq!(roll_rarity(GEAR_IRON_AXE, &low), Ok(RARITY_COMMON));
        low[0] = 0xff;
        low[1] = 0xff;
        low[2] = 0xff;
        low[3] = 0xff;
        // Iron cannot roll Legendary.
        assert!(roll_rarity(GEAR_IRON_AXE, &low).unwrap() <= 3);
        // Gilded can.
        low[0] = 0xfe;
        assert!(roll_rarity(GEAR_GILDED_BLADE, &low).unwrap() <= RARITY_LEGENDARY);
    }

    #[test]
    fn traits_fit_the_slot_table() {
        let vrf = [7u8; 32];
        let common = roll_traits(GEAR_IRON_AXE, RARITY_COMMON, &vrf).unwrap();
        assert_eq!(common[1].id, 0);
        let epic = roll_traits(GEAR_GILDED_BLADE, 3, &vrf).unwrap();
        assert!(epic[2].id != 0);
        for pair in epic.iter().take(3) {
            assert!(pair.tier >= 2 && pair.tier <= 4);
        }
    }
}
