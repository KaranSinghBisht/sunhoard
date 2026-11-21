//! Flag bits. Zero-copy accounts cannot store a bool.

pub const SEALED: u8 = 1 << 0;
pub const CRACKING: u8 = 1 << 1;
pub const PRISTINE: u8 = 1 << 2;
pub const SOCKETED: u8 = 1 << 3;
pub const LISTED: u8 = 1 << 4;
pub const BOUND: u8 = 1 << 5;
pub const DEMO: u8 = 1 << 6;

pub const DEMO_MODE: u8 = 1 << 0;
pub const HAS_KILLER: u8 = 1 << 1;
pub const HAS_EMBER: u8 = 1 << 2;
pub const SALT_PENDING: u8 = 1 << 3;
pub const GATHER_PENDING: u8 = 1 << 0;

pub const MODE_IDLE: u8 = 0;
pub const MODE_WAIT: u8 = 1;
pub const MODE_FIGHT: u8 = 2;

pub const CLEARED_T1: u8 = 1 << 0;
pub const IS_KILLER: u8 = 1 << 1;
pub const CLAIMED: u8 = 1 << 0;

pub const QUIRK_REVEALED: u8 = 1 << 0;
pub const POST_BUILT: u8 = 1 << 0;
pub const HAS_BLOCK: u8 = 1 << 1;

pub const INVENTORY_SLOTS: usize = 48;
pub const VILLAGER_SLOTS: usize = 16;
pub const POST_SLOTS: usize = 12;
pub const LISTING_SLOTS: usize = 64;
pub const PRESENCE_SLOTS: usize = 32;
pub const PLOT_SLOTS: usize = 8;
pub const SHOT_SLOTS: usize = 8;
pub const WYRM_NAME_LEN: usize = 16;
pub const ACCOUNT_LIMIT: usize = 10_240;
