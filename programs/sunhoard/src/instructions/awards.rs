//! Glints are conserved game units. The base vault independently pays its funded lamports.
use anchor_lang::prelude::*;
use session_keys::{Session, SessionTokenV2};

use super::committed::payout_rows;
use super::lair_tally::find_row;
use crate::errors::GameError;
use crate::logic::{numbers::{AGE_DEMO_SECS, AGE_LIVE_SECS}, split_pot};
use crate::state::*;

pub(crate) fn demo(flags: u8) -> bool {
    let bit = if flags & KILL_SNAPSHOT == 0 { DEMO_MODE } else { KILL_DEMO };
    flags & bit != 0
}

pub(crate) fn min_age(demo: bool) -> u64 {
    if demo { AGE_DEMO_SECS } else { AGE_LIVE_SECS }
}

pub(crate) fn freeze(season: &mut Season) -> Result<()> {
    let pot = if season.flags & KILL_SNAPSHOT == 0 {
        // A kill recorded before this upgrade has no separate kill-time snapshot.
        season.pot
    } else {
        let mut bytes = [0; 8];
        bytes[..4].copy_from_slice(&season.kill_pot_low);
        bytes[4..].copy_from_slice(&season.kill_pot_high);
        u64::from_le_bytes(bytes)
    };
    let len = usize::from(season.damage_len);
    let slots = season.damage.get_mut(..len).ok_or(error!(GameError::BadAccount))?;
    let rows = payout_rows(slots, season.flags);
    let split = split_pot(pot, &rows, min_age(demo(season.flags)))
        .map_err(|_| error!(GameError::NotReady))?;
    for (index, slot) in slots.iter_mut().enumerate() {
        slot.frozen_age.copy_from_slice(&slot.age_secs.min(0xff_ffff_ffff_ffff).to_le_bytes()[..7]);
        slot.age_secs = split.amounts[index];
    }
    season.flags |= GLINT_AWARDS;
    Ok(())
}

pub fn claim(ctx: Context<ClaimGlints>, season_number: u32) -> Result<()> {
    let season = &mut *ctx.accounts.season.load_mut()?;
    let payout = ctx.accounts.payout.load()?;
    require!(season.season_number == season_number && season.flags & GLINT_AWARDS != 0
        && payout.season_number == u64::from(season_number)
        && Clock::get()?.unix_timestamp < i64::from(payout.claim_until), GameError::NotReady);
    let index = find_row(season, &ctx.accounts.player.owner).ok_or(error!(GameError::NotReady))?;
    let row = &mut season.damage[index];
    let amount = row.age_secs;
    require!(amount > 0 && row.flags & GLINT_CLAIMED == 0, GameError::NotReady);
    row.flags |= GLINT_CLAIMED;
    season.pot = season.pot.checked_sub(amount).ok_or(error!(GameError::BadAmount))?;
    ctx.accounts.purse.glints = ctx.accounts.purse.glints.checked_add(amount)
        .ok_or(error!(GameError::BadAmount))?;
    Ok(())
}

#[derive(Accounts, Session)]
pub struct ClaimGlints<'info> {
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[account(seeds = [PAYOUT_SEED, &FIRST_SEASON_SEED], bump)]
    pub payout: AccountLoader<'info, Payout>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
