//! Permission accounts on the rollup. World is private and has no members.
//! Season, Market, PriceBoard and Presence are public.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::instructions::CreateEphemeralPermissionCpi;
use ephemeral_rollups_sdk::access_control::structs::{EphemeralMembersArgs, PERMISSION_SEED};
use ephemeral_rollups_sdk::consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID};

use crate::state::{
    Market, Presence, PriceBoard, Season, World, MARKET_SEED, PRESENCE_SEED, PRICES_SEED,
    SEASON_SEED, WORLD_SEED,
};

pub fn handle(ctx: Context<SetPermissionsShared>) -> Result<()> {
    let bumps = &ctx.bumps;
    open(
        &ctx.accounts.world.to_account_info(),
        &ctx.accounts.world_permission.to_account_info(),
        &ctx,
        WORLD_SEED,
        bumps.world,
        true,
    )?;
    open(
        &ctx.accounts.season.to_account_info(),
        &ctx.accounts.season_permission.to_account_info(),
        &ctx,
        SEASON_SEED,
        bumps.season,
        false,
    )?;
    open(
        &ctx.accounts.market.to_account_info(),
        &ctx.accounts.market_permission.to_account_info(),
        &ctx,
        MARKET_SEED,
        bumps.market,
        false,
    )?;
    open(
        &ctx.accounts.prices.to_account_info(),
        &ctx.accounts.prices_permission.to_account_info(),
        &ctx,
        PRICES_SEED,
        bumps.prices,
        false,
    )?;
    open(
        &ctx.accounts.presence.to_account_info(),
        &ctx.accounts.presence_permission.to_account_info(),
        &ctx,
        PRESENCE_SEED,
        bumps.presence,
        false,
    )?;
    Ok(())
}

fn open<'info>(
    account: &AccountInfo<'info>,
    permission: &AccountInfo<'info>,
    ctx: &Context<SetPermissionsShared<'info>>,
    seed: &[u8],
    bump: u8,
    private: bool,
) -> Result<()> {
    if permission.lamports() > 0 {
        return Ok(());
    }
    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[seed, &bump_seed];
    CreateEphemeralPermissionCpi {
        payer: account.clone(),
        permissioned_account: account.clone(),
        permission: permission.clone(),
        vault: ctx.accounts.ephemeral_vault.to_account_info(),
        magic_program: ctx.accounts.magic_program.to_account_info(),
        permission_program: ctx.accounts.permission_program.to_account_info(),
        args: EphemeralMembersArgs {
            is_private: private,
            members: Vec::new(),
        },
    }
    .invoke_signed(&[seeds])?;
    Ok(())
}

#[derive(Accounts)]
pub struct SetPermissionsShared<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [SEASON_SEED], bump, has_one = admin)]
    pub season: AccountLoader<'info, Season>,
    /// CHECK: Created by the permission program. Seeds match the example.
    #[account(mut, seeds = [PERMISSION_SEED, season.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub season_permission: UncheckedAccount<'info>,
    #[account(mut, seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
    /// CHECK: Created by the permission program. Seeds match the example.
    #[account(mut, seeds = [PERMISSION_SEED, world.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub world_permission: UncheckedAccount<'info>,
    #[account(mut, seeds = [MARKET_SEED], bump)]
    pub market: AccountLoader<'info, Market>,
    /// CHECK: Created by the permission program. Seeds match the example.
    #[account(mut, seeds = [PERMISSION_SEED, market.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub market_permission: UncheckedAccount<'info>,
    #[account(mut, seeds = [PRICES_SEED], bump)]
    pub prices: Account<'info, PriceBoard>,
    /// CHECK: Created by the permission program. Seeds match the example.
    #[account(mut, seeds = [PERMISSION_SEED, prices.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub prices_permission: UncheckedAccount<'info>,
    #[account(mut, seeds = [PRESENCE_SEED], bump)]
    pub presence: AccountLoader<'info, Presence>,
    /// CHECK: Created by the permission program. Seeds match the example.
    #[account(mut, seeds = [PERMISSION_SEED, presence.key().as_ref()], bump, seeds::program = PERMISSION_PROGRAM_ID)]
    pub presence_permission: UncheckedAccount<'info>,
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
