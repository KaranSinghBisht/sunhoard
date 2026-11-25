//! Equipping a gear item. The dungeon reads it when a run starts.

use anchor_lang::prelude::*;
use session_keys::{Session, SessionTokenV2};

use crate::errors::GameError;
use crate::logic::ids::is_gear_kind;
use crate::state::{Inventory, Player, INVENTORY_SEED, LISTED, PLAYER_SEED};

pub fn handle(ctx: Context<Equip>, slot: u8) -> Result<()> {
    let index = usize::from(slot);
    if index >= crate::state::INVENTORY_SLOTS {
        return err!(GameError::BadAmount);
    }
    let inventory = ctx.accounts.inventory.load()?;
    let item = &inventory.slots[index];
    if !is_gear_kind(item.kind) || item.quantity == 0 || item.flags & LISTED != 0 {
        return err!(GameError::BadAmount);
    }
    drop(inventory);
    ctx.accounts.player.equipped_slot = slot;
    Ok(())
}

#[derive(Accounts, Session)]
pub struct Equip<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
