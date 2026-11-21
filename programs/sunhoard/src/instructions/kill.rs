//! Debug-only damage table. Sixteen rows fit in one transaction; call again to add more.

use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{Season, World, CLEARED_T1, HAS_KILLER, IS_KILLER, SEASON_SEED, WORLD_SEED};

const GRANT_LIMIT: usize = 16;

struct DamageGrant {
    pub wallet: Pubkey,
    pub damage: u64,
    pub age_secs: u64,
    pub flags: u8,
}

pub fn handle(
    ctx: Context<DebugKill>,
    wallet: Vec<Pubkey>,
    damage: Vec<u64>,
    age_secs: Vec<u64>,
    flags: Vec<u8>,
    finish: u8,
) -> Result<()> {
    if finish > 1 || !same_len(&wallet, &damage, &age_secs, &flags) {
        return err!(GameError::BadAmount);
    }
    let rows = grants(&wallet, &damage, &age_secs, &flags);
    append(&mut *ctx.accounts.season.load_mut()?, &rows)?;
    if finish == 1 {
        ctx.accounts.world.hp = 0;
    }
    Ok(())
}

fn same_len(wallet: &[Pubkey], damage: &[u64], age: &[u64], flags: &[u8]) -> bool {
    wallet.len() <= GRANT_LIMIT
        && wallet.len() == damage.len()
        && wallet.len() == age.len()
        && wallet.len() == flags.len()
}

fn grants(wallet: &[Pubkey], damage: &[u64], age: &[u64], flags: &[u8]) -> Vec<DamageGrant> {
    let mut rows = Vec::with_capacity(wallet.len());
    for index in 0..wallet.len() {
        rows.push(DamageGrant {
            wallet: wallet[index],
            damage: damage[index],
            age_secs: age[index],
            flags: flags[index],
        });
    }
    rows
}

fn append(season: &mut Season, rows: &[DamageGrant]) -> Result<()> {
    let mut killers = usize::from(season.flags & HAS_KILLER != 0);
    let mut next = usize::from(season.damage_len);
    for row in rows {
        if row.flags & !(CLEARED_T1 | IS_KILLER) != 0 {
            return err!(GameError::BadAmount);
        }
        if row.flags & IS_KILLER != 0 {
            killers = killers.checked_add(1).ok_or(error!(GameError::NotReady))?;
        }
        if killers > 1 || next >= season.damage.len() {
            return err!(GameError::BadAmount);
        }
        write_row(season, next, row)?;
        next += 1;
    }
    season.damage_len = u8::try_from(next).map_err(|_| error!(GameError::NotReady))?;
    season.total_damage = total(season)?;
    Ok(())
}

fn write_row(season: &mut Season, index: usize, row: &DamageGrant) -> Result<()> {
    season.damage[index].wallet = row.wallet;
    season.damage[index].damage = row.damage;
    season.damage[index].age_secs = row.age_secs;
    season.damage[index].flags = row.flags;
    if row.flags & IS_KILLER != 0 {
        season.killer = row.wallet;
        season.flags |= HAS_KILLER;
    }
    Ok(())
}

fn total(season: &Season) -> Result<u64> {
    let mut sum = 0u64;
    for row in season.damage.iter().take(usize::from(season.damage_len)) {
        sum = sum
            .checked_add(row.damage)
            .ok_or(error!(GameError::NotReady))?;
    }
    Ok(sum)
}

#[derive(Accounts)]
pub struct DebugKill<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [SEASON_SEED], bump, has_one = admin)]
    pub season: AccountLoader<'info, Season>,
    #[account(mut, seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
}
