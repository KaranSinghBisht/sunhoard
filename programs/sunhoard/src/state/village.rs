//! Village, villagers, lantern posts and crop plots.

use anchor_lang::prelude::*;

use super::bits::{PLOT_SLOTS, POST_SLOTS, VILLAGER_SLOTS};

#[zero_copy]
pub struct Villager {
    pub id: u64,
    pub joined_at: i64,
    pub profession: u8,
    pub trait_id: u8,
    pub trait_tier: u8,
    pub personality: u8,
    pub quirk: u8,
    pub flags: u8,
    pub _pad: [u8; 2],
}

#[zero_copy]
pub struct Post {
    pub id: u64,
    pub purity_bp: u16,
    pub pattern: u16,
    pub x: u8,
    pub y: u8,
    pub tone: u8,
    pub grade: u8,
    pub flags: u8,
    pub escrow_slot_plus_one: u8,
    pub _pad: [u8; 6],
}

#[zero_copy]
pub struct Plot {
    pub planted_at: i64,
    pub kind: u8,
    pub _pad: [u8; 7],
}

#[account(zero_copy)]
pub struct Village {
    pub owner: Pubkey,
    pub warmth_x100: u16,
    pub barn_tier: u8,
    pub bell_flags: u8,
    pub beds: u16,
    pub _pad: [u8; 2],
    pub bell_until: i64,
    /// When villager output was last settled into the stockpile.
    pub last_collect: i64,
    pub stockpile: [u32; 5],
    pub _pad_stock: [u8; 4],
    pub workstations: [u8; 4],
    pub _pad_work: [u8; 4],
    pub villagers: [Villager; VILLAGER_SLOTS],
    pub posts: [Post; POST_SLOTS],
    pub plots: [Plot; PLOT_SLOTS],
}

impl Village {
    pub const LEN: usize = core::mem::size_of::<Village>();
}
