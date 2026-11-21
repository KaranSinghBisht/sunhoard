//! Debug-only sealed shell. This module is compiled only with `--features debug`.

use anchor_lang::prelude::*;

use super::mint::next_item_id;
use super::stack::{find_empty, recount};
use crate::errors::GameError;
use crate::logic::ids::SHELL_SMALL;
use crate::logic::{commitment, seal_key};
use crate::state::{
    Inventory, Player, Season, World, INVENTORY_SEED, PLAYER_SEED, SEALED, SEASON_SEED, WORLD_SEED,
};

pub fn handle(ctx: Context<DebugGrant>) -> Result<()> {
    let epoch = ctx.accounts.world.epoch;
    let salt = ctx
        .accounts
        .world
        .salts
        .get(usize::from(epoch))
        .copied()
        .ok_or(error!(GameError::NotReady))?;
    let id = next_item_id(&mut ctx.accounts.player)?;
    let key = seal_key(&salt, id);
    let mut inventory = ctx.accounts.inventory.load_mut()?;
    let index = find_empty(&inventory).ok_or(error!(GameError::Full))?;
    let slot = &mut inventory.slots[index];
    slot.id = id;
    slot.commitment = commitment(&key);
    slot.quantity = 1;
    slot.salt_epoch = epoch;
    slot.shell_size = SHELL_SMALL;
    slot.flags = SEALED;
    recount(&mut inventory);
    Ok(())
}

#[derive(Accounts)]
pub struct DebugGrant<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [SEASON_SEED], bump, has_one = admin)]
    pub season: AccountLoader<'info, Season>,
    #[account(seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
}
