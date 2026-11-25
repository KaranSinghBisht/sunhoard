//! Code IDs. Display text stays in the client's strings file.

pub const KIND_WOOD: u16 = 1;
pub const KIND_STONE: u16 = 2;
pub const KIND_COAL: u16 = 3;
pub const KIND_ORE: u16 = 4;
pub const KIND_FOOD: u16 = 5;
pub const KIND_WICKWAX: u16 = 6;
pub const KIND_PLANK: u16 = 7;
pub const KIND_BAR: u16 = 8;
pub const KIND_MEAL: u16 = 9;
pub const KIND_TORCH: u16 = 10;
pub const KIND_SEED: u16 = 11;

/// Gear kinds: one kind per tool and weapon recipe.
pub const GEAR_STONE_AXE: u16 = 12;
pub const GEAR_STONE_PICKAXE: u16 = 13;
pub const GEAR_IRON_AXE: u16 = 14;
pub const GEAR_IRON_PICKAXE: u16 = 15;
pub const GEAR_IRON_SWORD: u16 = 16;
pub const GEAR_GILDED_AXE: u16 = 17;
pub const GEAR_GILDED_PICKAXE: u16 = 18;
pub const GEAR_GILDED_BLADE: u16 = 19;

/// Tool traits (Efficient..Heavy) and weapon traits (Keen..Cursed).
pub const TRAIT_EFFICIENT: u8 = 1;
pub const TRAIT_BOUNTIFUL: u8 = 2;
pub const TRAIT_PROSPECTOR: u8 = 3;
pub const TRAIT_CLEAVE: u8 = 4;
pub const TRAIT_SWIFT: u8 = 5;
pub const TRAIT_BRITTLE: u8 = 6;
pub const TRAIT_HEAVY: u8 = 7;
pub const TRAIT_KEEN: u8 = 8;
pub const TRAIT_BRUTAL: u8 = 9;
pub const TRAIT_LOOTER: u8 = 10;
pub const TRAIT_DRAGONBANE: u8 = 11;
pub const TRAIT_VAMPIRIC: u8 = 12;
pub const TRAIT_DULL: u8 = 13;
pub const TRAIT_CURSED: u8 = 14;

pub const TONE_DAWN: u8 = 0;
pub const TONE_NOON: u8 = 1;
pub const TONE_BLUE_HOUR: u8 = 2;
pub const TONE_DUSK: u8 = 3;

pub const GRADE_DIM: u8 = 0;
pub const GRADE_GLOWING: u8 = 1;
pub const GRADE_BRIGHT: u8 = 2;
pub const GRADE_RADIANT: u8 = 3;
pub const GRADE_BLAZING: u8 = 4;

pub const SHELL_SMALL: u8 = 0;
pub const SHELL_MEDIUM: u8 = 1;
pub const SHELL_LARGE: u8 = 2;
pub const SHELL_CRATER: u8 = 3;
/// The day's first-clear boss block: sealed like a shell, thawed for free.
pub const SHELL_BOSS: u8 = 4;

pub const NODE_BIRCH: u8 = 0;
pub const NODE_ROCK: u8 = 1;
pub const NODE_COAL: u8 = 2;
pub const NODE_ORE: u8 = 3;
pub const NODE_BERRY: u8 = 4;

pub const MONSTER_RAT: u8 = 0;
pub const MONSTER_SLIME: u8 = 1;
pub const MONSTER_BAT: u8 = 2;
/// The Bramble Cellars boss, only in room 6.
pub const MONSTER_SNUFFER: u8 = 3;

pub const MAT_STONE: u8 = 0;
pub const MAT_IRON: u8 = 1;
pub const MAT_GILDED: u8 = 2;

pub const RARITY_COMMON: u8 = 0;
pub const RARITY_UNCOMMON: u8 = 1;
pub const RARITY_RARE: u8 = 2;
pub const RARITY_EPIC: u8 = 3;
pub const RARITY_LEGENDARY: u8 = 4;

pub const PROF_WOODCUTTER: u8 = 1;
pub const PROF_MINER: u8 = 2;
pub const PROF_FARMER: u8 = 3;
pub const PROF_SMITH: u8 = 4;

/// True when a kind is a gear item (a tool or weapon).
pub fn is_gear_kind(kind: u16) -> bool {
    (GEAR_STONE_AXE..=GEAR_GILDED_BLADE).contains(&kind)
}

/// True when a kind is a tool (axe or pickaxe).
pub fn is_tool_kind(kind: u16) -> bool {
    kind == GEAR_STONE_AXE
        || kind == GEAR_STONE_PICKAXE
        || kind == GEAR_IRON_AXE
        || kind == GEAR_IRON_PICKAXE
        || kind == GEAR_GILDED_AXE
        || kind == GEAR_GILDED_PICKAXE
}

/// The weapon material a gear kind is made of.
pub fn gear_material(kind: u16) -> u8 {
    match kind {
        GEAR_STONE_AXE | GEAR_STONE_PICKAXE => MAT_STONE,
        GEAR_IRON_AXE | GEAR_IRON_PICKAXE | GEAR_IRON_SWORD => MAT_IRON,
        _ => MAT_GILDED,
    }
}
