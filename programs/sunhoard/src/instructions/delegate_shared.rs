//! Delegates the five shared accounts. The Vault stays on Solana.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

use crate::state::{
    Vault, MARKET_SEED, PRESENCE_SEED, PRICES_SEED, SEASON_SEED, VAULT_SEED, WORLD_SEED,
};

use super::owner::{owner_of, still_ours};

pub fn handle(ctx: Context<DelegateShared>) -> Result<()> {
    step(
        &ctx,
        owner_of(&ctx.accounts.season.to_account_info()),
        |ctx| {
            ctx.accounts
                .delegate_season(&ctx.accounts.admin, &[SEASON_SEED], config(ctx))
        },
    )?;
    step(
        &ctx,
        owner_of(&ctx.accounts.world.to_account_info()),
        |ctx| {
            ctx.accounts
                .delegate_world(&ctx.accounts.admin, &[WORLD_SEED], config(ctx))
        },
    )?;
    step(
        &ctx,
        owner_of(&ctx.accounts.market.to_account_info()),
        |ctx| {
            ctx.accounts
                .delegate_market(&ctx.accounts.admin, &[MARKET_SEED], config(ctx))
        },
    )?;
    step(
        &ctx,
        owner_of(&ctx.accounts.prices.to_account_info()),
        |ctx| {
            ctx.accounts
                .delegate_prices(&ctx.accounts.admin, &[PRICES_SEED], config(ctx))
        },
    )?;
    step(
        &ctx,
        owner_of(&ctx.accounts.presence.to_account_info()),
        |ctx| {
            ctx.accounts
                .delegate_presence(&ctx.accounts.admin, &[PRESENCE_SEED], config(ctx))
        },
    )?;
    Ok(())
}

fn step<'info, F>(ctx: &Context<DelegateShared<'info>>, owner: Pubkey, call: F) -> Result<()>
where
    F: FnOnce(
        &Context<DelegateShared<'info>>,
    ) -> anchor_lang::solana_program::entrypoint::ProgramResult,
{
    if still_ours(&owner)? {
        call(ctx)?;
    }
    Ok(())
}

fn config(ctx: &Context<DelegateShared>) -> DelegateConfig {
    DelegateConfig {
        validator: Some(ctx.accounts.validator.key()),
        ..Default::default()
    }
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateShared<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [VAULT_SEED], bump, has_one = admin)]
    pub vault: Account<'info, Vault>,
    /// CHECK: Shared PDA. Unchecked so a retry still runs after the delegation program owns it.
    #[account(mut, del, seeds = [SEASON_SEED], bump)]
    pub season: UncheckedAccount<'info>,
    /// CHECK: Shared PDA. Unchecked so a retry still runs after the delegation program owns it.
    #[account(mut, del, seeds = [WORLD_SEED], bump)]
    pub world: UncheckedAccount<'info>,
    /// CHECK: Shared PDA. Unchecked so a retry still runs after the delegation program owns it.
    #[account(mut, del, seeds = [MARKET_SEED], bump)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: Shared PDA. Unchecked so a retry still runs after the delegation program owns it.
    #[account(mut, del, seeds = [PRICES_SEED], bump)]
    pub prices: UncheckedAccount<'info>,
    /// CHECK: Shared PDA. Unchecked so a retry still runs after the delegation program owns it.
    #[account(mut, del, seeds = [PRESENCE_SEED], bump)]
    pub presence: UncheckedAccount<'info>,
    /// CHECK: The TEE validator. The admin passes it; the program does not hardcode it.
    pub validator: UncheckedAccount<'info>,
}
