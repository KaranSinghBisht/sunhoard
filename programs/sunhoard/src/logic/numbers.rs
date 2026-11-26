//! Starting values from the economy notes. Glints elsewhere are hundredths.
//! Odds are parts per million. Fight time is 100 ms steps.

use super::ids::{SHELL_LARGE, SHELL_MEDIUM, SHELL_SMALL};

pub const PPM: u32 = 1_000_000;
pub const BP: u32 = 10_000;

pub const ENERGY_MAX: u32 = 100;
pub const ENERGY_REFILL_SECS: i64 = 36;
pub const FATIGUE_HALF: u32 = 500;
pub const FATIGUE_QUARTER: u32 = 800;
pub const GATHER_COOLDOWN_SECS: i64 = 3;
pub const GATHER_RANGE_UNITS: i32 = 24;
pub const ABERRATION_WORTH: u32 = 20;
pub const CLEAR_ABERRATION_PPM: u32 = PPM / 400;
pub const AURORA_ABERRATION_PPM: u32 = PPM / 120;
pub const AURORA_CYCLE_SECS: i64 = 30 * 60;
pub const AURORA_UP_SECS: i64 = 10 * 60;

/// Grade weights per shell: Small, Medium, Large, Crater, Boss. Each row sums to `PPM`.
pub const GRADE_PPM: [[u32; 5]; 5] = [
    [700_000, 220_000, 70_000, 9_000, 1_000],
    [450_000, 330_000, 150_000, 60_000, 10_000],
    [250_000, 350_000, 250_000, 120_000, 30_000],
    [0, 150_000, 450_000, 300_000, 100_000],
    [700_000, 250_000, 50_000, 0, 0],
];

pub const DUST_PPM: [u32; 5] = [700_000, 500_000, 250_000, 0, 0];
/// Frost dust paid when a shell is not a block, in Glint hundredths.
pub const DUST_HUNDREDTHS: [u64; 5] = [200, 500, 1_000, 0, 0];
/// Thaw fees in Glint hundredths. The table is 5, 12, 30, 0, and 0 Glints.
pub use crate::constants::THAW_FEE_HUNDREDTHS;
pub const PAIR_PPM_LARGE: u32 = 150_000;

pub const WEAPON_BASE: [u32; 3] = [6, 10, 16];
pub const RARITY_DAMAGE_BP: [u32; 5] = [10_000, 11_500, 13_000, 15_000, 17_500];
pub const CRIT_PPM: u32 = 50_000;
pub const CRIT_BP: u32 = 15_000;

pub const PLAYER_HP: i32 = 100;
pub const PLAYER_SPEED: i32 = 8;
pub const DASH_SPEED: i32 = 24;
pub const DASH_STEPS: u8 = 2;
pub const DASH_COOLDOWN_STEPS: u8 = 20;
pub const ATTACK_STEPS: u8 = 4;
pub const INVULN_STEPS: u8 = 6;
pub const REACH_UNITS: i32 = 20;
pub const CONTACT_UNITS: i32 = 8;
/// cos(45°) ≈ 181/256. Diagonal steps use this so a diagonal is not faster than a cardinal.
pub const DIAGONAL_NUM: i32 = 181;
pub const DIAGONAL_DEN: i32 = 256;

pub const MONSTER_HP: [i32; 3] = [18, 40, 24];
pub const MONSTER_DMG: [i32; 3] = [5, 8, 6];
pub const MONSTER_SPEED: [i32; 3] = [6, 2, 5];
pub const MONSTER_AGGRO: [i32; 3] = [96, 64, 128];
pub const MONSTER_REAIM: [u8; 3] = [1, 1, 5];

pub const MAX_MONSTERS: usize = 8;
pub const MAX_DAMAGE_ROWS: usize = 64;
pub const TICK_MIN_SLOTS: u64 = 8;
pub const TICK_MILLIS: i64 = 100;
pub const FIGHT_ITERATIONS: i64 = 8_000;
pub const ROOM_SIDE: i32 = 256;
pub const CLEAR_GLINT_HUNDREDTHS: u64 = 100;
pub const CLEAR_WICKWAX: u32 = 2;

pub const SPLIT_DAMAGE_PCT: u64 = 70;
pub const SPLIT_EQUAL_PCT: u64 = 20;
pub const SPLIT_KILLER_PCT: u64 = 10;
pub const SPLIT_CAP_PCT: u64 = 40;
pub const EQUAL_SHARE_PPM: u128 = 20_000;
pub const AGE_LIVE_SECS: u64 = 86_400;
pub const AGE_DEMO_SECS: u64 = 300;

pub const PHASE_LONG_NIGHT: u8 = 1;
pub const PHASE_SPRING: u8 = 2;
/// Pell's Wants rotate once an hour.
pub const WANTS_HOUR_SECS: i64 = 60 * 60;
/// Spring's first hour has no Hearth Penny; a minute in demo.
pub const FIRST_LIGHT_LIVE_SECS: i64 = 60 * 60;
pub const FIRST_LIGHT_DEMO_SECS: i64 = 60;
pub const SPRING_LIVE_SECS: i64 = 24 * 60 * 60;
pub const SPRING_DEMO_SECS: i64 = 5 * 60;
/// A pending salt request older than this may be asked again. Unix seconds.
pub const SALT_RELEASE_SECS: i64 = 120;
/// Where a fresh Keeper stands after `join`: the camp on the meadow map.
pub const MEADOW_SPAWN_X: u16 = 360;
pub const MEADOW_SPAWN_Y: u16 = 312;
pub const GLOAM_HP_LIVE: u64 = 66_000;
pub const GLOAM_HP_DEMO: u64 = 8_000;
pub const HP_SCALE_MIN_BP: u64 = 8_500;
pub const HP_SCALE_SPAN: u64 = 3_001;
pub const LONG_NIGHT_LIVE_SECS: i64 = 48 * 60 * 60;
pub const LONG_NIGHT_DEMO_SECS: i64 = 10 * 60;

// --- L1: Auntie Pell and the market (Glint hundredths) ---

/// Charter prices: what Auntie Pell pays for a material stack.
pub use crate::constants::CHARTER_MATERIAL;

/// Pell's shop prices: what she charges for a good she sells.
pub use crate::constants::SHOP_PRICE;

/// Pell's plain gear: kind to shop price in hundredths.
pub use crate::constants::GEAR_SHOP_PRICE;

/// Charter gear bases by material, in hundredths: stone 1, iron 5, gilded 8 Glints.
pub use crate::constants::GEAR_BASE_HUNDREDTHS;
/// Charter rarity multipliers in basis points: ×1, ×2.4, ×6, ×16, ×50.
pub use crate::constants::RARITY_PRICE_BP;
/// Block grade prices in hundredths: Dim 50, Glowing 90, Bright 160, Radiant 320, Blazing 800 Glints.
pub use crate::constants::GRADE_PRICE_HUNDREDTHS;
/// Pell pays grade price × (0.75 + 0.5 × purity) for a revealed block.
pub use crate::constants::BLOCK_PRICE_BASE_BP;
/// Sealed shells Pell buys, in hundredths: Small 10, Medium 25, Large 60 Glints.
pub const SHELL_PRICE_HUNDREDTHS: [u64; 4] = [1_000, 2_500, 6_000, 0];
/// A Want pays +50% while the board lists the kind and the time holds.
pub const WANT_BONUS_BP: u64 = 5_000;

// --- L1: crafting ---

pub const RECIPE_PLANKS: u8 = 1;
pub const RECIPE_BAR: u8 = 2;
pub const RECIPE_MEAL: u8 = 3;
pub const RECIPE_TORCH: u8 = 4;
pub const RECIPE_STONE_AXE: u8 = 5;
pub const RECIPE_STONE_PICKAXE: u8 = 6;
pub const RECIPE_IRON_AXE: u8 = 7;
pub const RECIPE_IRON_PICKAXE: u8 = 8;
pub const RECIPE_IRON_SWORD: u8 = 9;
pub const RECIPE_GILDED_AXE: u8 = 10;
pub const RECIPE_GILDED_PICKAXE: u8 = 11;
pub const RECIPE_GILDED_BLADE: u8 = 12;
pub const RECIPE_POST: u8 = 13;
pub const RECIPE_BED: u8 = 14;
pub const RECIPE_WORKSTATION: u8 = 15;
pub const RECIPE_COUNT: u8 = 15;

/// Crafted gear rarity in parts per million: stone and iron first, gilded second.
pub const GEAR_RARITY_PPM_STONE: [u32; 5] = [700_000, 240_000, 55_000, 5_000, 0];
pub const GEAR_RARITY_PPM_GILDED: [u32; 5] = [450_000, 330_000, 170_000, 45_000, 5_000];
/// Trait slots per rarity.
pub const RARITY_SLOTS: [u8; 5] = [1, 1, 2, 3, 3];
/// Trait tiers per rarity: (lowest, highest).
pub const RARITY_TIER_RANGE: [(u8, u8); 5] = [(1, 2), (1, 3), (2, 3), (2, 4), (3, 5)];
/// A crafted trait slot is a flaw at this rate, per rarity.
pub const FLAW_PPM: [u32; 5] = [150_000, 100_000, 50_000, 50_000, 0];
/// Efficient energy cut and Bountiful yield bump by tier I..V.
pub const EFFICIENT_BP: [u32; 6] = [0, 600, 1_000, 1_500, 2_000, 2_500];
pub const BOUNTIFUL_BP: [u32; 6] = [0, 1_000, 1_600, 2_500, 3_200, 4_000];
/// Keen crit chance by tier, in ppm: +3/+7/+12 pts at I/III/V.
pub const KEEN_PPM_BY_TIER: [u32; 6] = [0, 30_000, 50_000, 70_000, 95_000, 120_000];
/// Brutal crit damage by tier, in bp on top of the 1.5× base.
pub const BRUTAL_BP_BY_TIER: [u32; 6] = [0, 1_000, 2_000, 3_000, 4_000, 5_000];

/// Eating a meal restores this much energy, at most four meals a day.
pub const MEAL_ENERGY: u32 = 25;
pub const MEALS_PER_DAY: u8 = 4;

// --- L1: the six rooms and the Snuffer ---

pub const ROOMS_PER_RUN: u8 = 6;
/// Rooms 1–5 hold this many monsters: 5, 6, 7, 6, 7.
pub const ROOM_MONSTERS: [u8; 6] = [5, 6, 7, 6, 7, 1];
/// The lantern between rooms restores 30% of missing HP.
pub const ROOM_HEAL_BP: i32 = 3_000;
/// The Snuffer, room 6 only.
pub const SNUFFER_HP: i32 = 900;
pub const SNUFFER_SPEED: i32 = 2;
/// Telegraphs are at least 0.6 s: 6 steps.
pub const BOSS_TELEGRAPH_STEPS: u8 = 6;
/// Steps between the Snuffer's attacks.
pub const BOSS_ATTACK_GAP_STEPS: u8 = 60;
pub const BOSS_EMBER_DMG: i32 = 10;
pub const BOSS_EMBER_SPEED: i32 = 5;
pub const BOSS_EMBER_LIFE: u8 = 40;
pub const BOSS_WICK_DMG: i32 = 16;
pub const BOSS_WICK_SPEED: i32 = 4;
pub const BOSS_WICK_LIFE: u8 = 90;
pub const BOSS_SNUFF_DMG: i32 = 18;
pub const BOSS_SNUFF_RANGE: i32 = 24;
/// Snuff frost: −40% speed for 2 s, in steps.
pub const BOSS_FROST_STEPS: u8 = 20;
pub const SLOWED_SPEED: i32 = 5;
/// A projectile hits within this distance, squared.
pub const SHOT_HIT_UNITS: i32 = 10;
pub const SHOT_SLOTS: usize = 8;

// --- L1: chests ---

pub const CHEST_WOODEN: u8 = 0;
pub const CHEST_IRON: u8 = 1;
pub const CHEST_SILVER: u8 = 2;
pub const CHEST_CRYSTAL: u8 = 3;
pub const CHEST_SUN: u8 = 4;
pub const CHEST_PPM_LIVE: [u32; 5] = [750_000, 200_000, 45_000, 4_500, 500];
pub const CHEST_PPM_DEMO: [u32; 5] = [50_000, 150_000, 250_000, 500_000, 50_000];
pub const CHEST_GLINT_HUNDREDTHS: [u64; 5] = [300, 600, 1_200, 2_500, 5_000];
/// Gear per tier: wooden 30% Common, iron Uncommon, silver Rare, crystal Epic, sun Legendary.
pub const CHEST_GEAR_PPM: [u32; 5] = [300_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000];
/// Extra shell per tier: none, 10% Small, 25% Small, Medium, Large.
pub const CHEST_SHELL_PPM: [u32; 5] = [0, 100_000, 250_000, 1_000_000, 1_000_000];
pub const CHEST_SHELL_KIND: [u8; 5] = [SHELL_SMALL, SHELL_SMALL, SHELL_SMALL, SHELL_MEDIUM, SHELL_LARGE];
/// Full-value chests per tier per day; after that the tier drops by one.
pub const CHESTS_PER_DAY: u8 = 6;
