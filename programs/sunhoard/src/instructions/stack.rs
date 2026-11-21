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
