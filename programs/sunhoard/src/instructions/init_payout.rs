//! The season-1 payout record stays on Solana. It is not delegated.

use anchor_lang::prelude::*;

use crate::state::{Payout, Vault, FIRST_SEASON_SEED, PAYOUT_SEED, VAULT_SEED};

pub fn handle(_ctx: Context<InitPayout>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct InitPayout<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [VAULT_SEED], bump, has_one = admin)]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = admin,
        space = 8 + Payout::LEN,
        seeds = [PAYOUT_SEED, &FIRST_SEASON_SEED],
        bump
    )]
    pub payout: AccountLoader<'info, Payout>,
    pub system_program: Program<'info, System>,
}
