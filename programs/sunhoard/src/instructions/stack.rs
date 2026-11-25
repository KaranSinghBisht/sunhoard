//! Material stacks. A stack has a kind and a quantity, and no item id or flags.

use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{Inventory, ItemSlot};

pub(crate) fn add_kind(inventory: &mut Inventory, kind: u16, qty: u32) -> Result<()> {
    if kind == 0 {
        return err!(GameError::BadAmount);
    }
    let mut left = qty;
    while left > 0 {
        left = place(inventory, kind, left)?;
    }
    recount(inventory);
    Ok(())
}

/// Consumes the given ingredients across the stacks that hold them.
pub(crate) fn take_inputs(
    inventory: &mut Inventory,
    ingredients: &[crate::logic::craft::Ingredient],
) -> Result<()> {
    let mut needed: [u32; 12] = [0; 12];
    for ingredient in ingredients {
        let index = usize::from(ingredient.kind).saturating_sub(1);
        if index >= needed.len() {
            return err!(GameError::BadAmount);
        }
        needed[index] = needed[index]
            .checked_add(u32::from(ingredient.qty))
            .ok_or(error!(GameError::NotReady))?;
    }
    for (kind_index, want) in needed.iter().enumerate() {
        if *want == 0 {
            continue;
        }
        let kind = u16::try_from(kind_index + 1).map_err(|_| error!(GameError::BadAmount))?;
        take_kind(inventory, kind, *want)?;
    }
    recount(inventory);
    Ok(())
}

fn take_kind(inventory: &mut Inventory, kind: u16, mut want: u32) -> Result<()> {
    let mut indexes: Vec<usize> = Vec::new();
    for (index, slot) in inventory.slots.iter().enumerate() {
        if slot.kind == kind && slot.id == 0 && slot.flags == 0 {
            indexes.push(index);
        }
    }
    for index in indexes {
        if want == 0 {
            break;
        }
        let slot = &mut inventory.slots[index];
        let take = want.min(u32::from(slot.quantity));
        slot.quantity = slot
            .quantity
            .checked_sub(u16::try_from(take).map_err(|_| error!(GameError::NotReady))?)
            .ok_or(error!(GameError::BadAmount))?;
        if slot.quantity == 0 {
            clear_slot(slot);
        }
        want -= take;
    }
    if want > 0 {
        return err!(GameError::BadAmount);
    }
    Ok(())
}

/// Empties one slot completely.
/// Drops the equipped pointer when its slot is emptied, so the next item to
/// land there is not worn by accident.
pub(crate) fn unequip(player: &mut crate::state::Player, slot: usize) {
    if usize::from(player.equipped_slot) == slot {
        player.equipped_slot = u8::MAX;
    }
}

pub(crate) fn clear_slot(slot: &mut ItemSlot) {
    slot.id = 0;
    slot.commitment = [0; 32];
    slot.revealed_key = [0; 32];
    slot.cracking_since = 0;
    slot.kind = 0;
    slot.quantity = 0;
    slot.purity_bp = 0;
    slot.pattern = 0;
    slot.traits = [crate::state::TraitPair { id: 0, tier: 0 }; 4];
    slot.salt_epoch = 0;
    slot.shell_size = 0;
    slot.tone = 0;
    slot.grade = 0;
    slot.rarity = 0;
    slot.flags = 0;
}

fn place(inventory: &mut Inventory, kind: u16, left: u32) -> Result<u32> {
    if let Some(index) = find_open(inventory, kind) {
        return pour(&mut inventory.slots[index], left);
    }
    let index = find_empty(inventory).ok_or(error!(GameError::Full))?;
    inventory.slots[index].kind = kind;
    pour(&mut inventory.slots[index], left)
}

fn pour(slot: &mut ItemSlot, left: u32) -> Result<u32> {
    let room = u32::from(u16::MAX - slot.quantity);
    let take = left.min(room);
    if take == 0 {
        return err!(GameError::Full);
    }
    let added = u16::try_from(take).map_err(|_| error!(GameError::NotReady))?;
    slot.quantity = slot
        .quantity
        .checked_add(added)
        .ok_or(error!(GameError::NotReady))?;
    Ok(left - take)
}

fn find_open(inventory: &Inventory, kind: u16) -> Option<usize> {
    inventory.slots.iter().position(|slot| {
        slot.kind == kind && slot.id == 0 && slot.flags == 0 && slot.quantity < u16::MAX
    })
}

pub(crate) fn find_empty(inventory: &Inventory) -> Option<usize> {
    inventory
        .slots
        .iter()
        .position(|slot| slot.id == 0 && slot.kind == 0 && slot.quantity == 0 && slot.flags == 0)
}

pub(crate) fn recount(inventory: &mut Inventory) {
    let occupied = inventory
        .slots
        .iter()
        .filter(|slot| slot.id != 0 || slot.kind != 0 || slot.quantity != 0 || slot.flags != 0)
        .count();
    inventory.count = u8::try_from(occupied).unwrap_or(u8::MAX);
}
