//! The shared HP pool and the season's damage table. Every lair flush lands
//! here, and the flush that empties the pool crowns the killer.

use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::logic::numbers::{PHASE_LONG_NIGHT, PHASE_SPRING, SPRING_DEMO_SECS, SPRING_LIVE_SECS};
use crate::state::{
    Arena, Season, World, CLEARED_T1, DEMO_MODE, HAS_EMBER, HAS_KILLER, IS_KILLER, KILL_SNAPSHOT, KILL_DEMO,
};

pub(crate) fn raid_open(arena: &Arena, season: &Season) -> bool {
    arena.raid_season != 0 && arena.raid_season == season.season_number && season.phase == PHASE_LONG_NIGHT
}

pub(crate) fn can_participate(season: &Season, wallet: &Pubkey) -> bool {
    usize::from(season.damage_len) < season.damage.len()
        || find_row(season, wallet).is_some()
        || season.damage.iter().any(|row| row.damage == 0)
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
    if damage == 0 || world.hp == 0 || !raid_open(arena, season) || !can_participate(season, &arena.owner) {
        return Ok(false);
    }
    let counted = damage.min(world.hp);
    world.hp = world.hp.saturating_sub(counted);
    let index = match find_row(season, &arena.owner) {
        Some(index) => index,
        None => open_row(season, &arena.owner)?,
    };
    let [a, b, c] = arena.raid_age;
    let row = &mut season.damage[index];
    row.age_secs = row.age_secs.max(u64::from(u32::from_le_bytes([a, b, c, 0])));
    if arena.raid_cleared != 0 {
        row.flags |= CLEARED_T1;
    }
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
    let pot = season.pot.to_le_bytes();
    season.kill_pot_low.copy_from_slice(&pot[..4]);
    season.kill_pot_high.copy_from_slice(&pot[4..]);
    season.flags |= KILL_SNAPSHOT;
    if season.flags & DEMO_MODE != 0 {
        season.flags |= KILL_DEMO;
    }
    season.phase = PHASE_SPRING;
    season.phase_started = now;
    season.phase_ends = now
        .checked_add(spring)
        .ok_or(error!(GameError::NotReady))?;
    Ok(())
}

pub(crate) fn find_row(season: &Season, wallet: &Pubkey) -> Option<usize> {
    let len = usize::from(season.damage_len).min(season.damage.len());
    season
        .damage
        .iter()
        .take(len)
        .position(|row| row.wallet == *wallet)
}

fn open_row(season: &mut Season, wallet: &Pubkey) -> Result<usize> {
    let len = usize::from(season.damage_len).min(season.damage.len());
    let index = if len == season.damage.len() {
        // Reuse a pre-upgrade reservation that never dealt any damage.
        season.damage.iter().position(|row| row.damage == 0).ok_or(error!(GameError::NotReady))?
    } else {
        season.damage_len = u8::try_from(len + 1).map_err(|_| error!(GameError::NotReady))?;
        len
    };
    season.damage[index] = bytemuck::Zeroable::zeroed();
    season.damage[index].wallet = *wallet;
    Ok(index)
}
