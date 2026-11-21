//! Inventory slots and the smaller copy a listing escrows.
//! A cracking shell cannot be listed, so the listing drops `cracking_since`.

use anchor_lang::prelude::*;

use super::bits::INVENTORY_SLOTS;

#[zero_copy]
pub struct TraitPair {
    pub id: u8,
    pub tier: u8,
}

#[zero_copy]
pub struct ItemSlot {
    pub id: u64,
    pub commitment: [u8; 32],
    pub revealed_key: [u8; 32],
    pub cracking_since: u64,
    pub kind: u16,
    pub quantity: u16,
    pub purity_bp: u16,
    pub pattern: u16,
    pub traits: [TraitPair; 4],
    pub salt_epoch: u8,
    pub shell_size: u8,
    pub tone: u8,
    pub grade: u8,
    pub rarity: u8,
    pub flags: u8,
    pub _pad: [u8; 2],
}

#[zero_copy]
pub struct ListedItem {
    pub id: u64,
    pub commitment: [u8; 32],
    pub revealed_key: [u8; 32],
    pub kind: u16,
    pub quantity: u16,
    pub purity_bp: u16,
    pub pattern: u16,
    pub traits: [TraitPair; 4],
    pub salt_epoch: u8,
    pub shell_size: u8,
    pub tone: u8,
    pub grade: u8,
    pub rarity: u8,
    pub flags: u8,
    pub _pad: [u8; 2],
}

#[account(zero_copy)]
pub struct Inventory {
    pub owner: Pubkey,
    pub count: u8,
    pub _pad: [u8; 7],
    pub slots: [ItemSlot; INVENTORY_SLOTS],
}

impl Inventory {
    pub const LEN: usize = core::mem::size_of::<Inventory>();
}
