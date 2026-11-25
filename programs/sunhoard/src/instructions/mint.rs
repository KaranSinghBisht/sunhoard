//! Mints items: the next item id, a crafted or looted gear piece, and a sealed shell.

use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::logic::item_id;
use crate::state::{Inventory, ItemSlot, Player, SEALED};

use super::stack::{find_empty, recount};

pub(crate) fn next_item_id(player: &mut Player) -> Result<u64> {
    if player.player_number == 0 {
        return err!(GameError::NotReady);
    }
    let counter = player
        .item_counter
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    let id = item_id(player.player_number, counter).map_err(|_| error!(GameError::NotReady))?;
    player.item_counter = counter;
    Ok(id)
}

/// Writes a gear item into an empty slot: kind (which implies the material), rarity, no traits.
pub(crate) fn gear(player: &mut Player, inventory: &mut Inventory, kind: u16, rarity: u8) -> Result<()> {
    let id = next_item_id(player)?;
    let index = find_empty(inventory).ok_or(error!(GameError::Full))?;
    fill_gear(&mut inventory.slots[index], id, kind, rarity, [crate::state::TraitPair { id: 0, tier: 0 }; 4]);
    recount(inventory);
    Ok(())
}

/// Mints one sealed rimeshell of the given size. The key is the season salt
/// and the fresh item id; only the commitment is stored. Returns the slot.
pub(crate) fn shell(
    player: &mut Player,
    inventory: &mut Inventory,
    salt: &[u8; 32],
    epoch: u8,
    shell_size: u8,
) -> Result<usize> {
    let id = next_item_id(player)?;
    let key = crate::logic::seal_key(salt, id);
    let index = find_empty(inventory).ok_or(error!(GameError::Full))?;
    let slot = &mut inventory.slots[index];
    slot.id = id;
    slot.commitment = crate::logic::commitment(&key);
    slot.quantity = 1;
    slot.salt_epoch = epoch;
    slot.shell_size = shell_size;
    slot.flags = SEALED;
    recount(inventory);
    Ok(index)
}

/// Overwrites a crafted gear slot with its rolled rarity and traits.
pub(crate) fn fill_gear(
    slot: &mut ItemSlot,
    id: u64,
    kind: u16,
    rarity: u8,
    traits: [crate::state::TraitPair; 4],
) {
    slot.id = id;
    slot.kind = kind;
    slot.quantity = 1;
    slot.rarity = rarity;
    slot.traits = traits;
    slot.flags = 0;
}
