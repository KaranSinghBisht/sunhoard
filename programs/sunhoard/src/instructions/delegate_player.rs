//! Delegates one player's accounts in two transactions.
//! One account list of all six overflowed the SBF stack.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::state::{ARENA_SEED, INVENTORY_SEED, PLAYER_SEED, PURSE_SEED, VIEW_SEED, VILLAGE_SEED};

use super::owner::{owner_of, still_ours};

pub fn handle_pack(ctx: Context<DelegatePlayer>) -> Result<()> {
    step(
        &ctx,
        owner_of(&ctx.accounts.player.to_account_info()),
        |ctx| {
            ctx.accounts.delegate_player(
                &ctx.accounts.owner,
                &[PLAYER_SEED, ctx.accounts.owner.key().as_ref()],
                config(&ctx),
            )
        },
    )?;
    step(
        &ctx,
        owner_of(&ctx.accounts.purse.to_account_info()),
        |ctx| {
            ctx.accounts.delegate_purse(
                &ctx.accounts.owner,
                &[PURSE_SEED, ctx.accounts.owner.key().as_ref()],
                config(&ctx),
            )
        },
    )?;
    step(
        &ctx,
        owner_of(&ctx.accounts.inventory.to_account_info()),
        |ctx| {
            ctx.accounts.delegate_inventory(
                &ctx.accounts.owner,
                &[INVENTORY_SEED, ctx.accounts.owner.key().as_ref()],
                config(&ctx),
            )
        },
    )
}

pub fn handle_home(ctx: Context<DelegateHome>) -> Result<()> {
    step_home(
        &ctx,
        owner_of(&ctx.accounts.village.to_account_info()),
        |ctx| {
            ctx.accounts.delegate_village(
                &ctx.accounts.owner,
                &[VILLAGE_SEED, ctx.accounts.owner.key().as_ref()],
                config_home(&ctx),
            )
        },
    )?;
    step_home(
        &ctx,
        owner_of(&ctx.accounts.arena.to_account_info()),
        |ctx| {
            ctx.accounts.delegate_arena(
                &ctx.accounts.owner,
                &[ARENA_SEED, ctx.accounts.owner.key().as_ref()],
                config_home(&ctx),
            )
        },
    )?;
    step_home(
        &ctx,
        owner_of(&ctx.accounts.view.to_account_info()),
        |ctx| {
            ctx.accounts.delegate_view(
                &ctx.accounts.owner,
                &[VIEW_SEED, ctx.accounts.owner.key().as_ref()],
                config_home(&ctx),
            )
        },
    )
}

fn step<'info, F>(ctx: &Context<DelegatePlayer<'info>>, owner: Pubkey, call: F) -> Result<()>
where
    F: FnOnce(
        &Context<DelegatePlayer<'info>>,
    ) -> anchor_lang::solana_program::entrypoint::ProgramResult,
{
    if still_ours(&owner)? {
        call(ctx)?;
    }
    Ok(())
}

fn step_home<'info, F>(ctx: &Context<DelegateHome<'info>>, owner: Pubkey, call: F) -> Result<()>
where
    F: FnOnce(
        &Context<DelegateHome<'info>>,
    ) -> anchor_lang::solana_program::entrypoint::ProgramResult,
{
    if still_ours(&owner)? {
        call(ctx)?;
    }
    Ok(())
}

fn config(ctx: &Context<DelegatePlayer>) -> DelegateConfig {
    DelegateConfig {
        validator: Some(ctx.accounts.validator.key()),
        ..Default::default()
    }
}

fn config_home(ctx: &Context<DelegateHome>) -> DelegateConfig {
    DelegateConfig {
        validator: Some(ctx.accounts.validator.key()),
        ..Default::default()
    }
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePlayer<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Owner PDA. Unchecked so a retry still runs after delegation.
    #[account(mut, del, seeds = [PLAYER_SEED, owner.key().as_ref()], bump)]
    pub player: UncheckedAccount<'info>,
    /// CHECK: Owner PDA. Unchecked so a retry still runs after delegation.
    #[account(mut, del, seeds = [PURSE_SEED, owner.key().as_ref()], bump)]
    pub purse: UncheckedAccount<'info>,
    /// CHECK: Owner PDA. Unchecked so a retry still runs after delegation.
    #[account(mut, del, seeds = [INVENTORY_SEED, owner.key().as_ref()], bump)]
    pub inventory: UncheckedAccount<'info>,
    /// CHECK: The TEE validator. The owner passes it; the program does not hardcode it.
    pub validator: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateHome<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Owner PDA. Unchecked so a retry still runs after delegation.
    #[account(mut, del, seeds = [VILLAGE_SEED, owner.key().as_ref()], bump)]
    pub village: UncheckedAccount<'info>,
    /// CHECK: Owner PDA. Unchecked so a retry still runs after delegation.
    #[account(mut, del, seeds = [ARENA_SEED, owner.key().as_ref()], bump)]
    pub arena: UncheckedAccount<'info>,
    /// CHECK: Owner PDA. Unchecked so a retry still runs after delegation.
    #[account(mut, del, seeds = [VIEW_SEED, owner.key().as_ref()], bump)]
    pub view: UncheckedAccount<'info>,
    /// CHECK: The TEE validator. The owner passes it; the program does not hardcode it.
    pub validator: UncheckedAccount<'info>,
}
