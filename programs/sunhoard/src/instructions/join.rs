//! First rollup visit. Purse and View become private to the owner.
//! Nell arrives bound, with one bound Dim Dawn block.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::instructions::CreateEphemeralPermissionCpi;
use ephemeral_rollups_sdk::access_control::structs::{
    EphemeralMembersArgs, Member, PERMISSION_SEED, TX_BALANCES_FLAG, TX_LOGS_FLAG, TX_MESSAGE_FLAG,
};
use ephemeral_rollups_sdk::consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID};

use crate::errors::GameError;
use crate::logic::ids::{GRADE_DIM, PROF_WOODCUTTER, TONE_DAWN};
use crate::logic::item_id;
use crate::state::{
    Inventory, Player, Purse, Season, View, Village, BOUND, INVENTORY_SEED, PLAYER_SEED, PRISTINE,
    PURSE_SEED, SEASON_SEED, VIEW_SEED, VILLAGE_SEED,
};

pub fn handle(mut ctx: Context<Join>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let number = {
        let season = &mut *ctx.accounts.season.load_mut()?;
        assign(season, &mut ctx.accounts.player)?
    };
    give(&mut ctx, number, now)?;
    let owner = ctx.accounts.owner.key();
    open(
        &ctx.accounts.purse.to_account_info(),
        &ctx.accounts.purse_permission.to_account_info(),
        &ctx,
        PURSE_SEED,
        ctx.bumps.purse,
        owner,
    )?;
    open(
        &ctx.accounts.view.to_account_info(),
        &ctx.accounts.view_permission.to_account_info(),
        &ctx,
        VIEW_SEED,
        ctx.bumps.view,
        owner,
    )?;
    Ok(())
}

fn assign(season: &mut Season, player: &mut Player) -> Result<u32> {
    if player.player_number != 0 || season.season_number == 0 {
        return err!(GameError::NotReady);
    }
    let next = season
        .player_count
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    item_id(next, 2).map_err(|_| error!(GameError::NotReady))?;
    season.player_count = next;
    player.player_number = next;
    player.item_counter = 2;
    Ok(next)
}

fn give(ctx: &mut Context<Join>, player_number: u32, now: i64) -> Result<()> {
    let gem = item_id(player_number, 1).map_err(|_| error!(GameError::NotReady))?;
    let nell = item_id(player_number, 2).map_err(|_| error!(GameError::NotReady))?;
    let mut inventory = ctx.accounts.inventory.load_mut()?;
    inventory.count = 1;
    inventory.slots[0].id = gem;
    inventory.slots[0].quantity = 1;
    inventory.slots[0].tone = TONE_DAWN;
    inventory.slots[0].grade = GRADE_DIM;
    inventory.slots[0].flags = BOUND | PRISTINE;
    drop(inventory);
    let mut village = ctx.accounts.village.load_mut()?;
    village.villagers[0].id = nell;
    village.villagers[0].joined_at = now;
    village.villagers[0].profession = PROF_WOODCUTTER;
    village.villagers[0].flags = BOUND;
    Ok(())
}

fn open<'info>(
    account: &AccountInfo<'info>,
    permission: &AccountInfo<'info>,
    ctx: &Context<Join<'info>>,
    seed: &[u8],
    bump: u8,
    owner: Pubkey,
) -> Result<()> {
    if permission.lamports() > 0 {
        return Ok(());
    }
    let bump_seed = [bump];
    let owner_seed = ctx.accounts.owner.key();
    let seeds: &[&[u8]] = &[seed, owner_seed.as_ref(), &bump_seed];
    CreateEphemeralPermissionCpi {
        payer: account.clone(),
        permissioned_account: account.clone(),
        permission: permission.clone(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        args: EphemeralMembersArgs {
            is_private: true,
            members: vec![Member {
                flags: TX_LOGS_FLAG | TX_MESSAGE_FLAG | TX_BALANCES_FLAG,
                pubkey: owner,
            }],
        },
    }
    .invoke_signed(&[seeds])?;
    Ok(())
}

#[derive(Accounts)]
pub struct Join<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[account(mut, seeds = [PLAYER_SEED, owner.key().as_ref()], bump, has_one = owner)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [PURSE_SEED, owner.key().as_ref()], bump, has_one = owner)]
    pub purse: Account<'info, Purse>,
    /// CHECK: Created by the permission program. Seeds match the example.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, purse.key().as_ref()],
        bump,
        seeds::program = PERMISSION_PROGRAM_ID
    )]
    pub purse_permission: UncheckedAccount<'info>,
    #[account(mut, seeds = [VIEW_SEED, owner.key().as_ref()], bump, has_one = owner)]
    pub view: Account<'info, View>,
    /// CHECK: Created by the permission program. Seeds match the example.
    #[account(
        mut,
        seeds = [PERMISSION_SEED, view.key().as_ref()],
        bump,
        seeds::program = PERMISSION_PROGRAM_ID
    )]
    pub view_permission: UncheckedAccount<'info>,
    #[account(mut, seeds = [INVENTORY_SEED, owner.key().as_ref()], bump, has_one = owner)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [VILLAGE_SEED, owner.key().as_ref()], bump, has_one = owner)]
    pub village: AccountLoader<'info, Village>,
    /// CHECK: Permission program id, checked by the address constraint.
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: Ephemeral rent vault, checked by the address constraint.
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: Magic program id, checked by the address constraint.
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
}
