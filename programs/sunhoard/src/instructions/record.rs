//! The Magic Action writes the SOL split. Each slayer claims once from the Vault.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::action;
use ephemeral_rollups_sdk::pda::ephemeral_balance_pda_from_payer;

use super::committed::read_committed;
use crate::errors::GameError;
use crate::logic::numbers::{SPRING_DEMO_SECS, SPRING_LIVE_SECS};
use crate::logic::split_pot;
use crate::state::{
    Payout, PayoutRow, Vault, CLAIMED, FIRST_SEASON_SEED, HAS_KILLER, PAYOUT_SEED,
    SEASON_SEED, SETTLED, VAULT_SEED,
};
use bytemuck::Zeroable;

const ACTION_ESCROW_INDEX: u8 = 255;

pub fn record(ctx: Context<RecordPayout>) -> Result<()> {
    let data = ctx.accounts.season.try_borrow_data()?;
    let committed = read_committed(&data)?;
    drop(data);
    let ending = u64::from(committed.season_number);
    if ending == 0 || committed.admin != ctx.accounts.escrow_auth.key() {
        return err!(GameError::BadAccount);
    }
    // Only a season that ended in a kill and was settled has a split to write.
    if committed.flags & (HAS_KILLER | SETTLED) != (HAS_KILLER | SETTLED) {
        return err!(GameError::NotReady);
    }
    // One record serves every season. A season is written once; the next one
    // overwrites it, and any share left unclaimed stays in the vault for that pot.
    if ctx.accounts.payout.load()?.season_number >= ending {
        return Ok(());
    }
    let now = Clock::get()?.unix_timestamp;
    require!(now >= i64::from(ctx.accounts.payout.load()?.claim_until), GameError::NotReady);
    let demo = super::awards::demo(committed.flags);
    let min_age = super::awards::min_age(demo);
    let duration = if demo { SPRING_DEMO_SECS } else { SPRING_LIVE_SECS };
    let deadline = now.checked_add(duration).and_then(|t| u32::try_from(t).ok())
        .ok_or(error!(GameError::NotReady))?;
    ctx.accounts.payout.load_mut()?.claim_until = deadline;
    let pot = spendable(&ctx.accounts.vault.to_account_info())?;
    let split =
        split_pot(pot, &committed.rows, min_age).map_err(|_| error!(GameError::NotReady))?;
    write_payout(
        &mut *ctx.accounts.payout.load_mut()?,
        &committed.rows,
        &split,
        pot,
        ending,
    )
}

pub fn claim(mut ctx: Context<Claim>) -> Result<()> {
    let amount = mark_claimed(&mut ctx)?;
    move_lamports(
        &ctx.accounts.vault.to_account_info(),
        &ctx.accounts.wallet.to_account_info(),
        amount,
    )
}

fn mark_claimed(ctx: &mut Context<Claim>) -> Result<u64> {
    let payout = &mut *ctx.accounts.payout.load_mut()?;
    if payout.season_number == 0 {
        return err!(GameError::NotReady);
    }
    require!(payout.claim_until == 0 || Clock::get()?.unix_timestamp < i64::from(payout.claim_until), GameError::NotReady);
    let index = find_row(payout, ctx.accounts.wallet.key())?;
    let amount = payout.rows[index].amount;
    if amount == 0 {
        return err!(GameError::BadAmount);
    }
    payout.rows[index].flags |= CLAIMED;
    Ok(amount)
}

fn write_payout(
    payout: &mut Payout,
    rows: &[crate::logic::DamageRow],
    split: &crate::logic::Split,
    pot: u64,
    season_number: u64,
) -> Result<()> {
    let len = split.len;
    if len > payout.rows.len() {
        return err!(GameError::NotReady);
    }
    for row in payout.rows.iter_mut().skip(len) {
        *row = PayoutRow::zeroed();
    }
    for index in 0..len {
        let wallet = Pubkey::try_from(rows[index].wallet.as_slice())
            .map_err(|_| error!(GameError::BadAccount))?;
        payout.rows[index] = PayoutRow {
            wallet,
            amount: split.amounts[index],
            flags: 0,
            _pad: [0; 7],
        };
    }
    payout.len = u8::try_from(len).map_err(|_| error!(GameError::NotReady))?;
    payout.pot = pot;
    payout.unpaid = split.unpaid;
    payout.season_number = season_number;
    Ok(())
}

fn move_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    let left = from
        .lamports()
        .checked_sub(amount)
        .ok_or(error!(GameError::BadAmount))?;
    let rent = Rent::get()?.minimum_balance(from.data_len());
    if left < rent {
        return err!(GameError::BadAmount);
    }
    **from.try_borrow_mut_lamports()? = left;
    let credited = to
        .lamports()
        .checked_add(amount)
        .ok_or(error!(GameError::NotReady))?;
    **to.try_borrow_mut_lamports()? = credited;
    Ok(())
}

fn find_row(payout: &Payout, wallet: Pubkey) -> Result<usize> {
    let len = usize::from(payout.len).min(payout.rows.len());
    for index in 0..len {
        let row = &payout.rows[index];
        if row.wallet == wallet && row.flags & CLAIMED == 0 {
            return Ok(index);
        }
    }
    err!(GameError::NotReady)
}

fn spendable(vault: &AccountInfo) -> Result<u64> {
    let rent = Rent::get()?.minimum_balance(vault.data_len());
    Ok(vault.lamports().saturating_sub(rent))
}

#[action]
#[derive(Accounts)]
pub struct RecordPayout<'info> {
    /// CHECK: Committed Season. Its owner may still be the delegation program.
    #[account(seeds = [SEASON_SEED], bump)]
    pub season: UncheckedAccount<'info>,
    #[account(mut, seeds = [PAYOUT_SEED, &FIRST_SEASON_SEED], bump)]
    pub payout: AccountLoader<'info, Payout>,
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: Account<'info, Vault>,
    /// CHECK: This program. The action runtime passes it before the escrow.
    #[account(address = crate::ID)]
    pub source_program: UncheckedAccount<'info>,
    /// CHECK: Must be the admin stored on Season. The handler compares them.
    pub escrow_auth: UncheckedAccount<'info>,
    /// CHECK: Magic escrow PDA. Only the delegation program can sign it.
    #[account(
        signer,
        address = ephemeral_balance_pda_from_payer(&escrow_auth.key(), ACTION_ESCROW_INDEX)
    )]
    pub escrow: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    #[account(mut, seeds = [PAYOUT_SEED, &FIRST_SEASON_SEED], bump)]
    pub payout: AccountLoader<'info, Payout>,
    #[account(mut, seeds = [VAULT_SEED], bump)]
    pub vault: Account<'info, Vault>,
}
