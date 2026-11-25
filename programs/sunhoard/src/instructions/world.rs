//! The season clock crank: phase transitions, Pell's Wants, bounties. The
//! admin schedules it once; anyone may tick it, at most once a minute.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use magicblock_magic_program_api::args::ScheduleTaskArgs;

use super::crank_ix;
use crate::errors::GameError;
use crate::logic::numbers::{
    FIRST_LIGHT_DEMO_SECS, FIRST_LIGHT_LIVE_SECS, LONG_NIGHT_DEMO_SECS, LONG_NIGHT_LIVE_SECS,
    PHASE_LONG_NIGHT, PHASE_SPRING, SPRING_DEMO_SECS, SPRING_LIVE_SECS, WANTS_HOUR_SECS,
};
use crate::logic::world::{pick_bounties, pick_two, survive_pot, WORLD_TICK_SECS};
use crate::state::{PriceBoard, Season, World, DEMO_MODE, PRICES_SEED, SEASON_SEED, WORLD_SEED};

/// One crank for the whole season: a tick a minute for a week.
pub const WORLD_CRANK_INTERVAL_MILLIS: i64 = 60_000;
pub const WORLD_CRANK_ITERATIONS: i64 = 10_000;

pub fn schedule(ctx: Context<ScheduleWorld>) -> Result<()> {
    if ctx.accounts.magic_program.key().to_bytes() != MAGIC_PROGRAM_ID.to_bytes() {
        return err!(GameError::BadAccount);
    }
    let tick = Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.season.to_account_info().key(), false),
            AccountMeta::new(ctx.accounts.world.to_account_info().key(), false),
            AccountMeta::new(ctx.accounts.prices.to_account_info().key(), false),
        ],
        data: anchor_lang::InstructionData::data(&crate::instruction::TickWorld {}),
    };
    let payer = ctx.accounts.admin.to_account_info();
    let payer_again = payer.clone();
    let season = ctx.accounts.season.to_account_info();
    let world = ctx.accounts.world.to_account_info();
    let prices = ctx.accounts.prices.to_account_info();
    crank_ix::schedule(
        payer,
        ctx.accounts.magic_program.to_account_info(),
        &[payer_again, season, world, prices],
        ScheduleTaskArgs {
            task_id: 1,
            execution_interval_millis: WORLD_CRANK_INTERVAL_MILLIS,
            iterations: WORLD_CRANK_ITERATIONS,
            instructions: vec![tick],
        },
    )
}

pub fn tick(ctx: Context<TickWorld>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let season = &mut *ctx.accounts.season.load_mut()?;
    if season.season_number == 0 {
        return Ok(());
    }
    if now.saturating_sub(ctx.accounts.prices.last_rotation) < WORLD_TICK_SECS {
        return Ok(());
    }
    ctx.accounts.prices.last_rotation = now;
    let demo = season.flags & DEMO_MODE != 0;
    let salt = ctx.accounts.world.salts[usize::from(ctx.accounts.world.epoch)];
    let mut phase = season.phase;
    if phase == PHASE_LONG_NIGHT && now >= season.phase_ends {
        // The Long Night ended with Old Gloam alive: half the pot burns.
        let (carries, burned) = survive_pot(season.pot).map_err(|_| error!(GameError::NotReady))?;
        season.pot = carries;
        season.burned = season
            .burned
            .checked_add(burned)
            .ok_or(error!(GameError::NotReady))?;
        phase = PHASE_SPRING;
        season.phase = phase;
        season.phase_started = now;
        season.phase_ends = now
            .checked_add(if demo { SPRING_DEMO_SECS } else { SPRING_LIVE_SECS })
            .ok_or(error!(GameError::NotReady))?;
    }
    let _ = phase;
    let _ = (LONG_NIGHT_DEMO_SECS, LONG_NIGHT_LIVE_SECS, FIRST_LIGHT_DEMO_SECS, FIRST_LIGHT_LIVE_SECS);
    // Pell's Wants: two goods at +50% for an hour.
    let hour = now / WANTS_HOUR_SECS;
    let (a, b) = pick_two(&salt, hour);
    ctx.accounts.prices.good_a = a;
    ctx.accounts.prices.good_b = b;
    ctx.accounts.prices.until = now
        .checked_add(WANTS_HOUR_SECS)
        .ok_or(error!(GameError::NotReady))?;
    // Bounties: three kinds a day.
    if hour % 24 == 0 {
        ctx.accounts.prices.bounty_kind = pick_bounties(&salt, hour);
    }
    Ok(())
}

#[derive(Accounts)]
pub struct ScheduleWorld<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [SEASON_SEED], bump, has_one = admin)]
    pub season: AccountLoader<'info, Season>,
    #[account(mut, seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
    #[account(mut, seeds = [PRICES_SEED], bump)]
    pub prices: Account<'info, PriceBoard>,
    /// CHECK: MagicBlock magic program. The handler checks its id.
    pub magic_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct TickWorld<'info> {
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[account(mut, seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
    #[account(mut, seeds = [PRICES_SEED], bump)]
    pub prices: Account<'info, PriceBoard>,
}
