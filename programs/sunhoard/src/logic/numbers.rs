//! Starting values from the economy notes. Glints elsewhere are hundredths.
//! Odds are parts per million. Fight time is 100 ms steps.

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

/// Grade weights per shell: Small, Medium, Large, Crater. Each row sums to `PPM`.
pub const GRADE_PPM: [[u32; 5]; 4] = [
    [700_000, 220_000, 70_000, 9_000, 1_000],
    [450_000, 330_000, 150_000, 60_000, 10_000],
    [250_000, 350_000, 250_000, 120_000, 30_000],
    [0, 150_000, 450_000, 300_000, 100_000],
];

pub const DUST_PPM: [u32; 4] = [700_000, 500_000, 250_000, 0];
/// Frost dust paid when a shell is not a block, in Glint hundredths.
pub const DUST_HUNDREDTHS: [u64; 4] = [200, 500, 1_000, 0];
/// Thaw fees in Glint hundredths. The table is 5, 12, 30, and 0 Glints.
pub const THAW_FEE_HUNDREDTHS: [u64; 4] = [500, 1_200, 3_000, 0];
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
pub const GLOAM_HP_LIVE: u64 = 66_000;
pub const GLOAM_HP_DEMO: u64 = 8_000;
pub const HP_SCALE_MIN_BP: u64 = 8_500;
pub const HP_SCALE_SPAN: u64 = 3_001;
pub const LONG_NIGHT_LIVE_SECS: i64 = 48 * 60 * 60;
pub const LONG_NIGHT_DEMO_SECS: i64 = 10 * 60;
