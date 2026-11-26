//! Reads a committed Season without copying the whole account onto the stack.

use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::logic::numbers::MAX_DAMAGE_ROWS;
use crate::logic::DamageRow;
use crate::state::{DamageSlot, Season, CLEARED_T1, IS_KILLER};

pub struct Committed {
    pub admin: Pubkey,
    pub season_number: u32,
    pub flags: u8,
    pub rows: Vec<DamageRow>,
}

pub fn read_committed(data: &[u8]) -> Result<Committed> {
    let admin = pubkey_at(data, core::mem::offset_of!(Season, admin))?;
    let season_number = u32_at(data, core::mem::offset_of!(Season, season_number))?;
    let flags = byte_at(data, core::mem::offset_of!(Season, flags))?;
    let len = usize::from(byte_at(data, core::mem::offset_of!(Season, damage_len))?);
    if len > MAX_DAMAGE_ROWS {
        return err!(GameError::BadAccount);
    }
    let rows = rows_at(data, len, flags)?;
    Ok(Committed {
        admin,
        season_number,
        flags,
        rows,
    })
}

fn rows_at(data: &[u8], len: usize, flags: u8) -> Result<Vec<DamageRow>> {
    let start = 8 + core::mem::offset_of!(Season, damage);
    let end = start + len * core::mem::size_of::<DamageSlot>();
    let bytes = data.get(start..end).ok_or(error!(GameError::BadAccount))?;
    let slots: &[DamageSlot] =
        bytemuck::try_cast_slice(bytes).map_err(|_| error!(GameError::BadAccount))?;
    Ok(payout_rows(slots, flags))
}

pub(crate) fn payout_rows(slots: &[DamageSlot], flags: u8) -> Vec<DamageRow> {
    let mut rows = Vec::with_capacity(slots.len());
    for slot in slots {
        rows.push(DamageRow {
            wallet: slot.wallet.to_bytes(),
            damage: slot.damage,
            cleared_t1: slot.flags & CLEARED_T1 != 0,
            age_secs: if flags & crate::state::GLINT_AWARDS != 0 {
                let mut bytes = [0; 8];
                bytes[..7].copy_from_slice(&slot.frozen_age);
                u64::from_le_bytes(bytes)
            } else {
                slot.age_secs
            },
            killer: slot.flags & IS_KILLER != 0,
        });
    }
    rows
}

fn pubkey_at(data: &[u8], offset: usize) -> Result<Pubkey> {
    let start = 8 + offset;
    let bytes = data
        .get(start..start + 32)
        .ok_or(error!(GameError::BadAccount))?;
    Pubkey::try_from(bytes).map_err(|_| error!(GameError::BadAccount))
}

fn u32_at(data: &[u8], offset: usize) -> Result<u32> {
    let start = 8 + offset;
    let bytes = data
        .get(start..start + 4)
        .ok_or(error!(GameError::BadAccount))?;
    let mut word = [0u8; 4];
    word.copy_from_slice(bytes);
    Ok(u32::from_le_bytes(word))
}

fn byte_at(data: &[u8], offset: usize) -> Result<u8> {
    data.get(8 + offset)
        .copied()
        .ok_or(error!(GameError::BadAccount))
}
