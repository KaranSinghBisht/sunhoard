//! Demo mode: the admin flips it on and grants labelled items for the video.

use anchor_lang::prelude::*;

use super::mint;
use crate::errors::GameError;
use crate::state::{
    Inventory, Player, Season, World, DEMO, DEMO_MODE, INVENTORY_SEED, PLAYER_SEED, SEASON_SEED,
    WORLD_SEED,
};

/// The admin turns demo mode on or off. Demo grants work only while it is on.
pub fn set_demo_mode(ctx: Context<SetDemoMode>, demo: u8) -> Result<()> {
    let season = &mut *ctx.accounts.season.load_mut()?;
    if demo == 0 {
        season.flags &= !DEMO_MODE;
    } else {
        season.flags |= DEMO_MODE;
    }
    Ok(())
}

/// Grants the chosen wallet one item, tagged DEMO. Demo mode must be on.
/// `kind` picks a gear item (12..=19); `shell` 1..=5 mints a sealed shell.
pub fn demo_grant(ctx: Context<DemoGrant>, kind: u16, rarity: u8, shell: u8) -> Result<()> {
    if ctx.accounts.season.load()?.flags & DEMO_MODE == 0 {
        return err!(GameError::NotReady);
    }
    let mut inventory = ctx.accounts.inventory.load_mut()?;
    let player = &mut ctx.accounts.player;
    if crate::logic::ids::is_gear_kind(kind) {
        if rarity > crate::logic::ids::RARITY_LEGENDARY {
            return err!(GameError::BadAmount);
        }
        let id = mint::next_item_id(player)?;
        let slot_index = super::stack::find_empty(&inventory).ok_or(error!(GameError::Full))?;
        mint::fill_gear(
            &mut inventory.slots[slot_index],
            id,
            kind,
            rarity,
            [crate::state::TraitPair { id: 0, tier: 0 }; 4],
        );
        inventory.slots[slot_index].flags |= DEMO;
    } else if shell >= 1 && shell <= 5 {
        let epoch = ctx.accounts.world.epoch;
        let salt = ctx
            .accounts
            .world
            .salts
            .get(usize::from(epoch))
            .copied()
            .ok_or(error!(GameError::NotReady))?;
        let slot_index = mint::shell(player, &mut inventory, &salt, epoch, shell - 1)?;
        inventory.slots[slot_index].flags |= DEMO;
    } else {
        return err!(GameError::BadAmount);
    }
    super::stack::recount(&mut inventory);
    Ok(())
}

#[derive(Accounts)]
pub struct SetDemoMode<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [SEASON_SEED], bump, has_one = admin)]
    pub season: AccountLoader<'info, Season>,
}

#[derive(Accounts)]
pub struct DemoGrant<'info> {
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
