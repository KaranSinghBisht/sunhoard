//! Shared accounts and the small per-player accounts.

use anchor_lang::prelude::*;

use super::bits::{LISTING_SLOTS, PRESENCE_SLOTS, WYRM_NAME_LEN};
use super::item::ListedItem;
use crate::logic::numbers::MAX_DAMAGE_ROWS;

pub const SEASON_SEED: &[u8] = b"season";
pub const WORLD_SEED: &[u8] = b"world";
pub const MARKET_SEED: &[u8] = b"market";
pub const PRICES_SEED: &[u8] = b"prices";
pub const PRESENCE_SEED: &[u8] = b"presence";
pub const VAULT_SEED: &[u8] = b"vault";
pub const PLAYER_SEED: &[u8] = b"player";
pub const PURSE_SEED: &[u8] = b"purse";
pub const INVENTORY_SEED: &[u8] = b"inventory";
pub const VILLAGE_SEED: &[u8] = b"village";
pub const ARENA_SEED: &[u8] = b"arena";
pub const VIEW_SEED: &[u8] = b"view";
pub const PAYOUT_SEED: &[u8] = b"payout";
pub const FIRST_SEASON: u64 = 1;
pub const FIRST_SEASON_SEED: [u8; 8] = FIRST_SEASON.to_le_bytes();

#[zero_copy]
pub struct DamageSlot {
    pub wallet: Pubkey,
    pub damage: u64,
    pub age_secs: u64,
    pub flags: u8,
    pub _pad: [u8; 7],
}

#[account(zero_copy)]
pub struct Season {
    pub admin: Pubkey,
    pub killer: Pubkey,
    pub ember_holder: Pubkey,
    pub pot: u64,
    pub burned: u64,
    pub total_damage: u64,
    pub phase_started: i64,
    pub phase_ends: i64,
    pub season_number: u32,
    pub sealed_legendaries: u32,
    pub player_count: u32,
    pub damage_len: u8,
    pub phase: u8,
    pub flags: u8,
    pub _pad: [u8; 5],
    pub wyrm_name: [u8; WYRM_NAME_LEN],
    pub _pad_name: [u8; 4],
    pub damage: [DamageSlot; MAX_DAMAGE_ROWS],
}

impl Season {
    pub const LEN: usize = core::mem::size_of::<Season>();
}

#[account]
#[repr(C)]
pub struct World {
    pub salts: [[u8; 32]; 4],
    pub hp: u64,
    pub max_hp: u64,
    pub warmest: u64,
    pub epoch: u8,
    pub traits: [u8; 4],
    pub _pad: [u8; 3],
}

impl World {
    pub const LEN: usize = core::mem::size_of::<World>();
}

#[zero_copy]
pub struct Listing {
    pub seller: Pubkey,
    pub price: u64,
    pub listed_at: i64,
    pub expires_at: i64,
    pub item: ListedItem,
}

#[account(zero_copy)]
pub struct Market {
    pub count: u8,
    pub _pad: [u8; 7],
    pub listings: [Listing; LISTING_SLOTS],
}

impl Market {
    pub const LEN: usize = core::mem::size_of::<Market>();
}

#[account]
#[repr(C)]
pub struct PriceBoard {
    pub good_a: u16,
    pub good_b: u16,
    pub _pad: [u8; 4],
    pub until: i64,
    pub bounty_kind: [u16; 3],
    pub _pad_bounty: [u8; 2],
    pub last_rotation: i64,
}

impl PriceBoard {
    pub const LEN: usize = core::mem::size_of::<PriceBoard>();
}

#[zero_copy]
pub struct PresenceRow {
    pub player: Pubkey,
    pub updated: i64,
    pub x: u16,
    pub y: u16,
    pub zone: u8,
    pub facing: u8,
    pub _pad: [u8; 2],
}

#[account(zero_copy)]
pub struct Presence {
    pub count: u8,
    pub _pad: [u8; 7],
    pub rows: [PresenceRow; PRESENCE_SLOTS],
}

impl Presence {
    pub const LEN: usize = core::mem::size_of::<Presence>();
}

#[account]
#[repr(C)]
pub struct Vault {
    pub admin: Pubkey,
}

impl Vault {
    pub const LEN: usize = core::mem::size_of::<Vault>();
}

#[zero_copy]
pub struct PayoutRow {
    pub wallet: Pubkey,
    pub amount: u64,
    pub flags: u8,
    pub _pad: [u8; 7],
}

#[account(zero_copy)]
pub struct Payout {
    pub season_number: u64,
    pub pot: u64,
    pub unpaid: u64,
    pub len: u8,
    pub _pad: [u8; 7],
    pub rows: [PayoutRow; MAX_DAMAGE_ROWS],
}

impl Payout {
    pub const LEN: usize = core::mem::size_of::<Payout>();
}

#[account]
#[repr(C)]
pub struct Player {
    pub owner: Pubkey,
    pub energy_last: i64,
    pub player_number: u32,
    pub energy: u32,
    pub energy_used_today: u32,
    pub item_counter: u32,
    pub first_clears: u32,
    pub bounties: u16,
    pub zone: u8,
    pub tutorial: u8,
    pub x: u16,
    pub y: u16,
    pub chests: [u16; 4],
    pub heat: [u16; 5],
    pub _pad: [u8; 2],
    pub moved_at: i64,
    pub gather_at: i64,
    pub gather_nonce: u64,
    pub gather_used: u32,
    pub gather_node: u8,
    pub gather_flags: u8,
    pub _pad_gather: [u8; 2],
}

impl Player {
    pub const LEN: usize = core::mem::size_of::<Player>();
}

#[account]
#[repr(C)]
pub struct Purse {
    pub owner: Pubkey,
    pub glints: u64,
}

impl Purse {
    pub const LEN: usize = core::mem::size_of::<Purse>();
}

#[account]
#[repr(C)]
pub struct View {
    pub owner: Pubkey,
    pub gloam_hp: u64,
    pub flags: u8,
    pub _pad: [u8; 7],
}

impl View {
    pub const LEN: usize = core::mem::size_of::<View>();
}
