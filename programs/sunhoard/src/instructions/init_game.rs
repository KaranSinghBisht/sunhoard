//! Creates the shared accounts on Solana and prefunds what the rollup spends later.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::instruction_builder::top_up_ephemeral_balance;
use ephemeral_rollups_sdk::pda::ephemeral_balance_pda_from_payer;

use super::pay::{pay, permission_rent};

use crate::errors::GameError;
use crate::state::{
    Market, Presence, PriceBoard, Season, Vault, World, MARKET_SEED, PRESENCE_SEED, PRICES_SEED,
    SEASON_SEED, VAULT_SEED, WORLD_SEED,
};

/// Same index `ActionArgs::new` uses in magicblock-magic-program-api 0.10.1.
const ACTION_ESCROW_INDEX: u8 = 255;
/// Same top-up the magic-actions example test sends.
const ESCROW_LAMPORTS: u64 = 10_000;

pub fn handle(mut ctx: Context<InitGame>, vault_lamports: u64) -> Result<()> {
    if vault_lamports == 0 {
        return err!(GameError::BadAmount);
    }
    check_programs(&ctx)?;
    seed_owners(&mut ctx)?;
    prefund_permissions(&ctx)?;
    pay(
        &ctx.accounts.admin.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        vault_lamports,
    )?;
    fund_escrow(&ctx)
}

fn check_programs(ctx: &Context<InitGame>) -> Result<()> {
    let delegation = ephemeral_rollups_sdk::id().to_bytes();
    if ctx.accounts.delegation_program.key().to_bytes() != delegation {
        return err!(GameError::BadAccount);
    }
    let expected = ephemeral_balance_pda_from_payer(&ctx.accounts.admin.key(), ACTION_ESCROW_INDEX);
    if ctx.accounts.escrow.key().to_bytes() != expected.to_bytes() {
        return err!(GameError::BadAccount);
    }
    Ok(())
}

fn seed_owners(ctx: &mut Context<InitGame>) -> Result<()> {
    let admin = ctx.accounts.admin.key();
    ctx.accounts.season.load_init()?.admin = admin;
    ctx.accounts.market.load_init()?;
    ctx.accounts.presence.load_init()?;
    ctx.accounts.vault.admin = admin;
    Ok(())
}

fn prefund_permissions(ctx: &Context<InitGame>) -> Result<()> {
    let lamports = permission_rent(0);
    let from = ctx.accounts.admin.to_account_info();
    pay(&from, &ctx.accounts.season.to_account_info(), lamports)?;
    pay(&from, &ctx.accounts.world.to_account_info(), lamports)?;
    pay(&from, &ctx.accounts.market.to_account_info(), lamports)?;
    pay(&from, &ctx.accounts.prices.to_account_info(), lamports)?;
    pay(&from, &ctx.accounts.presence.to_account_info(), lamports)?;
    Ok(())
}

fn fund_escrow(ctx: &Context<InitGame>) -> Result<()> {
    let admin = ctx.accounts.admin.key();
    let ix = top_up_ephemeral_balance(
        admin,
        admin,
        Some(ESCROW_LAMPORTS),
        Some(ACTION_ESCROW_INDEX),
    );
    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            ctx.accounts.admin.to_account_info(),
            ctx.accounts.admin.to_account_info(),
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct InitGame<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Season::LEN, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[account(init, payer = admin, space = 8 + World::LEN, seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
    #[account(init, payer = admin, space = 8 + Market::LEN, seeds = [MARKET_SEED], bump)]
    pub market: AccountLoader<'info, Market>,
    #[account(init, payer = admin, space = 8 + PriceBoard::LEN, seeds = [PRICES_SEED], bump)]
    pub prices: Account<'info, PriceBoard>,
    #[account(init, payer = admin, space = 8 + Presence::LEN, seeds = [PRESENCE_SEED], bump)]
    pub presence: AccountLoader<'info, Presence>,
    #[account(init, payer = admin, space = 8 + Vault::LEN, seeds = [VAULT_SEED], bump)]
    pub vault: Account<'info, Vault>,
    /// CHECK: Magic Action escrow. The handler checks the SDK's balance PDA.
    #[account(mut)]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: MagicBlock delegation program. The handler checks its id.
    pub delegation_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}
