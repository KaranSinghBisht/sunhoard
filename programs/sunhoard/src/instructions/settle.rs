//! Old Gloam is dead. Commit Season and schedule the Solana payout record.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{CallHandler, FoldableIntentBuilder, MagicIntentBundleBuilder};
use ephemeral_rollups_sdk::{ActionArgs, ShortAccountMeta};

use crate::errors::GameError;
use crate::state::{
    Season, SETTLED, World, FIRST_SEASON_SEED, PAYOUT_SEED, SEASON_SEED, VAULT_SEED, WORLD_SEED,
};

const ACTION_UNITS: u32 = 400_000;

pub fn handle(ctx: Context<SettleSeason>) -> Result<()> {
    if ctx.accounts.world.hp != 0 || ctx.accounts.season.load()?.season_number == 0 {
        return err!(GameError::NotReady);
    }
    // Marked before the commit, so the committed copy carries it and the next
    // season cannot open over an unrecorded split.
    {
        let mut season = ctx.accounts.season.load_mut()?;
        require!(season.flags & crate::state::HAS_KILLER != 0, GameError::NotReady);
        if season.flags & SETTLED == 0 {
            super::awards::freeze(&mut season)?;
            season.flags |= SETTLED;
        }
    }
    let data = anchor_lang::InstructionData::data(&crate::instruction::RecordPayout {});
    let action = CallHandler {
        destination_program: crate::ID,
        accounts: vec![
            short(&ctx.accounts.season.key(), false),
            short(&ctx.accounts.payout.key(), true),
            short(&ctx.accounts.vault.key(), false),
        ],
        args: ActionArgs::new(data),
        escrow_authority: ctx.accounts.admin.to_account_info(),
        compute_units: ACTION_UNITS,
    };
    MagicIntentBundleBuilder::new(
        ctx.accounts.admin.to_account_info(),
        ctx.accounts.magic_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
    )
    .commit(&[ctx.accounts.season.to_account_info()])
    .add_post_commit_actions([action])
    .build_and_invoke()?;
    Ok(())
}

fn short(pubkey: &Pubkey, is_writable: bool) -> ShortAccountMeta {
    ShortAccountMeta {
        pubkey: pubkey.to_bytes().into(),
        is_writable,
    }
}

#[commit]
#[derive(Accounts)]
pub struct SettleSeason<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [SEASON_SEED], bump, has_one = admin)]
    pub season: AccountLoader<'info, Season>,
    #[account(seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
    /// CHECK: The Solana payout record. Created by `init_payout` and never delegated.
    #[account(seeds = [PAYOUT_SEED, &FIRST_SEASON_SEED], bump)]
    pub payout: UncheckedAccount<'info>,
    /// CHECK: The Solana vault. The action reads its lamports.
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: Destination program for the scheduled action.
    #[account(address = crate::ID)]
    pub program_id: UncheckedAccount<'info>,
}
