//! The shared HP pool and the season's damage table. Every lair flush lands
//! here, and the flush that empties the pool crowns the killer.

use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::logic::numbers::{PHASE_SPRING, SPRING_DEMO_SECS, SPRING_LIVE_SECS};
use crate::state::{
    Arena, Season, World, CLEARED_T1, DEMO_MODE, HAS_EMBER, HAS_KILLER, IS_KILLER,
};

/// Ensures the wallet has a damage row and refreshes what the payout's equal
/// share checks: the wallet's age and whether it has cleared the cellars.
pub(crate) fn ensure_row(
    season: &mut Season,
    wallet: &Pubkey,
    age_secs: u64,
    cleared_t1: bool,
) -> Result<()> {
    let index = match find_row(season, wallet) {
        Some(index) => index,
        None => open_row(season, wallet)?,
    };
    let row = &mut season.damage[index];
    row.age_secs = row.age_secs.max(age_secs);
    if cleared_t1 {
        row.flags |= CLEARED_T1;
    }
    Ok(())
}

/// Drains the arena's unflushed damage into the shared pool, once. Damage
/// past the last point of HP is not counted. Returns true when this flush
/// was the killing blow.
pub(crate) fn flush(
    arena: &mut Arena,
    season: &mut Season,
    world: &mut World,
    now: i64,
) -> Result<bool> {
    let damage = core::mem::take(&mut arena.unflushed_damage);
    if damage == 0 || world.hp == 0 {
        return Ok(false);
    }
    let counted = damage.min(world.hp);
    world.hp = world.hp.saturating_sub(counted);
    let index = match find_row(season, &arena.owner) {
        Some(index) => index,
        None => open_row(season, &arena.owner)?,
    };
    season.damage[index].damage = season.damage[index]
        .damage
        .checked_add(counted)
        .ok_or(error!(GameError::NotReady))?;
    season.total_damage = season
        .total_damage
        .checked_add(counted)
        .ok_or(error!(GameError::NotReady))?;
    if world.hp > 0 {
        return Ok(false);
    }
    crown(season, index, now)?;
    Ok(true)
}

/// A drifted spark heals Old Gloam, but never back from the dead.
pub(crate) fn heal(world: &mut World, amount: u64) {
    if world.hp == 0 {
        return;
    }
    world.hp = world.hp.saturating_add(amount).min(world.max_hp);
}

/// The killing blow: the row and the season remember the killer, the Ember
/// Egg goes with it, and the Long Night ends in Spring.
fn crown(season: &mut Season, index: usize, now: i64) -> Result<()> {
    if season.flags & HAS_KILLER != 0 {
        return Ok(());
    }
    let wallet = season.damage[index].wallet;
    season.damage[index].flags |= IS_KILLER;
    season.killer = wallet;
    season.ember_holder = wallet;
    season.flags |= HAS_KILLER | HAS_EMBER;
    let spring = if season.flags & DEMO_MODE != 0 {
        SPRING_DEMO_SECS
    } else {
        SPRING_LIVE_SECS
    };
    season.phase = PHASE_SPRING;
    season.phase_started = now;
    season.phase_ends = now
        .checked_add(spring)
        .ok_or(error!(GameError::NotReady))?;
    Ok(())
}

fn find_row(season: &Season, wallet: &Pubkey) -> Option<usize> {
    let len = usize::from(season.damage_len).min(season.damage.len());
    season
        .damage
        .iter()
        .take(len)
        .position(|row| row.wallet == *wallet)
}

fn open_row(season: &mut Season, wallet: &Pubkey) -> Result<usize> {
    let len = usize::from(season.damage_len).min(season.damage.len());
    if len >= season.damage.len() {
        return err!(GameError::NotReady);
    }
    let row = &mut season.damage[len];
    row.wallet = *wallet;
    row.damage = 0;
    row.age_secs = 0;
    row.flags = 0;
    season.damage_len = u8::try_from(len + 1).map_err(|_| error!(GameError::NotReady))?;
    Ok(len)
}
