use crate::errors::LogicError;

use super::numbers::{
    EQUAL_SHARE_PPM, MAX_DAMAGE_ROWS, PPM, SPLIT_CAP_PCT, SPLIT_DAMAGE_PCT, SPLIT_EQUAL_PCT,
    SPLIT_KILLER_PCT,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DamageRow {
    pub wallet: [u8; 32],
    pub damage: u64,
    pub cleared_t1: bool,
    pub age_secs: u64,
    pub killer: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Split {
    pub amounts: [u64; MAX_DAMAGE_ROWS],
    pub len: usize,
    pub unpaid: u64,
}

/// 70% by damage, 20% to wallets at or above 2% that have cleared T1 and are old enough,
/// 10% to the killer. No wallet is paid more than 40%. Leftovers stay unpaid.
pub fn split_pot(pot: u64, rows: &[DamageRow], min_age_secs: u64) -> Result<Split, LogicError> {
    if rows.len() > MAX_DAMAGE_ROWS {
        return Err(LogicError::TooManyRows);
    }
    if rows.iter().filter(|row| row.killer).count() > 1 {
        return Err(LogicError::ManyKillers);
    }
    let mut amounts = [0u64; MAX_DAMAGE_ROWS];
    let total = sum_damage(rows)?;
    if pot == 0 || total == 0 {
        return Ok(Split {
            amounts,
            len: rows.len(),
            unpaid: pot,
        });
    }
    let (damage_pool, equal_pool, killer_pool, mut unpaid) = pools(pot)?;
    assign_damage(&mut amounts, rows, damage_pool, total)?;
    unpaid = unpaid
        .checked_add(assign_equal(
            &mut amounts,
            rows,
            equal_pool,
            total,
            min_age_secs,
        )?)
        .ok_or(LogicError::Overflow)?;
    unpaid = unpaid
        .checked_add(assign_killer(&mut amounts, rows, killer_pool)?)
        .ok_or(LogicError::Overflow)?;
    unpaid = unpaid
        .checked_add(apply_cap(&mut amounts, rows, pot)?)
        .ok_or(LogicError::Overflow)?;
    Ok(Split {
        amounts,
        len: rows.len(),
        unpaid,
    })
}

fn pools(pot: u64) -> Result<(u64, u64, u64, u64), LogicError> {
    let damage = part(pot, SPLIT_DAMAGE_PCT)?;
    let equal = part(pot, SPLIT_EQUAL_PCT)?;
    let killer = part(pot, SPLIT_KILLER_PCT)?;
    let paid = damage
        .checked_add(equal)
        .and_then(|sum| sum.checked_add(killer))
        .ok_or(LogicError::Overflow)?;
    let dust = pot.checked_sub(paid).ok_or(LogicError::Overflow)?;
    Ok((damage, equal, killer, dust))
}

fn part(pot: u64, pct: u64) -> Result<u64, LogicError> {
    mul_div(pot, pct, 100)
}

fn sum_damage(rows: &[DamageRow]) -> Result<u64, LogicError> {
    let mut total = 0u64;
    for row in rows {
        total = total.checked_add(row.damage).ok_or(LogicError::Overflow)?;
    }
    Ok(total)
}

fn assign_damage(
    amounts: &mut [u64; MAX_DAMAGE_ROWS],
    rows: &[DamageRow],
    pool: u64,
    total: u64,
) -> Result<(), LogicError> {
    let mut given = 0u64;
    let mut best_i = 0usize;
    let mut best = 0u64;
    for (index, row) in rows.iter().enumerate() {
        let share = mul_div(pool, row.damage, total)?;
        amounts[index] = share;
        given = given.checked_add(share).ok_or(LogicError::Overflow)?;
        if row.damage >= best {
            best = row.damage;
            best_i = index;
        }
    }
    let dust = pool.checked_sub(given).ok_or(LogicError::Overflow)?;
    amounts[best_i] = amounts[best_i]
        .checked_add(dust)
        .ok_or(LogicError::Overflow)?;
    Ok(())
}

fn assign_equal(
    amounts: &mut [u64; MAX_DAMAGE_ROWS],
    rows: &[DamageRow],
    pool: u64,
    total: u64,
    min_age_secs: u64,
) -> Result<u64, LogicError> {
    let mut indexes = [0usize; MAX_DAMAGE_ROWS];
    let mut count = 0usize;
    for (index, row) in rows.iter().enumerate() {
        if qualifies(row, total, min_age_secs) {
            indexes[count] = index;
            count += 1;
        }
    }
    if count == 0 {
        return Ok(pool);
    }
    let each = pool / count as u64;
    let mut given = 0u64;
    for slot in 0..count {
        amounts[indexes[slot]] = amounts[indexes[slot]]
            .checked_add(each)
            .ok_or(LogicError::Overflow)?;
        given = given.checked_add(each).ok_or(LogicError::Overflow)?;
    }
    let dust = pool.checked_sub(given).ok_or(LogicError::Overflow)?;
    let first = indexes[0];
    amounts[first] = amounts[first]
        .checked_add(dust)
        .ok_or(LogicError::Overflow)?;
    Ok(0)
}

fn qualifies(row: &DamageRow, total: u64, min_age_secs: u64) -> bool {
    if !row.cleared_t1 || row.age_secs < min_age_secs {
        return false;
    }
    u128::from(row.damage) * u128::from(PPM) >= u128::from(total) * EQUAL_SHARE_PPM
}

fn assign_killer(
    amounts: &mut [u64; MAX_DAMAGE_ROWS],
    rows: &[DamageRow],
    pool: u64,
) -> Result<u64, LogicError> {
    match rows.iter().position(|row| row.killer) {
        Some(index) => {
            amounts[index] = amounts[index]
                .checked_add(pool)
                .ok_or(LogicError::Overflow)?;
            Ok(0)
        }
        None => Ok(pool),
    }
}

fn apply_cap(
    amounts: &mut [u64; MAX_DAMAGE_ROWS],
    rows: &[DamageRow],
    pot: u64,
) -> Result<u64, LogicError> {
    let cap = part(pot, SPLIT_CAP_PCT)?;
    let mut unpaid = 0u64;
    for _ in 0..MAX_DAMAGE_ROWS {
        let (excess, weight) = clip_to_cap(amounts, rows, cap)?;
        if excess == 0 {
            break;
        }
        if weight == 0 {
            unpaid = unpaid.checked_add(excess).ok_or(LogicError::Overflow)?;
            break;
        }
        unpaid = unpaid
            .checked_add(spread(amounts, rows, cap, excess, weight)?)
            .ok_or(LogicError::Overflow)?;
    }
    Ok(unpaid)
}

fn clip_to_cap(
    amounts: &mut [u64; MAX_DAMAGE_ROWS],
    rows: &[DamageRow],
    cap: u64,
) -> Result<(u64, u64), LogicError> {
    let mut excess = 0u64;
    let mut weight = 0u64;
    for (index, row) in rows.iter().enumerate() {
        if amounts[index] > cap {
            excess = excess
                .checked_add(amounts[index] - cap)
                .ok_or(LogicError::Overflow)?;
            amounts[index] = cap;
        } else if amounts[index] < cap {
            weight = weight.checked_add(row.damage).ok_or(LogicError::Overflow)?;
        }
    }
    Ok((excess, weight))
}

fn spread(
    amounts: &mut [u64; MAX_DAMAGE_ROWS],
    rows: &[DamageRow],
    cap: u64,
    excess: u64,
    weight: u64,
) -> Result<u64, LogicError> {
    let mut given = 0u64;
    for (index, row) in rows.iter().enumerate() {
        if amounts[index] >= cap {
            continue;
        }
        let room = cap - amounts[index];
        let add = mul_div(excess, row.damage, weight)?.min(room);
        amounts[index] = amounts[index]
            .checked_add(add)
            .ok_or(LogicError::Overflow)?;
        given = given.checked_add(add).ok_or(LogicError::Overflow)?;
    }
    let dust = excess.checked_sub(given).ok_or(LogicError::Overflow)?;
    place_dust(amounts, rows, cap, dust)
}

fn place_dust(
    amounts: &mut [u64; MAX_DAMAGE_ROWS],
    rows: &[DamageRow],
    cap: u64,
    dust: u64,
) -> Result<u64, LogicError> {
    let mut best: Option<usize> = None;
    for (index, row) in rows.iter().enumerate() {
        if amounts[index] >= cap {
            continue;
        }
        let better = best
            .map(|slot| row.damage >= rows[slot].damage)
            .unwrap_or(true);
        if better {
            best = Some(index);
        }
    }
    let Some(best) = best else {
        return Ok(dust);
    };
    let add = dust.min(cap - amounts[best]);
    amounts[best] = amounts[best].checked_add(add).ok_or(LogicError::Overflow)?;
    Ok(dust - add)
}

fn mul_div(a: u64, b: u64, d: u64) -> Result<u64, LogicError> {
    if d == 0 {
        return Err(LogicError::Overflow);
    }
    let value = u128::from(a)
        .checked_mul(u128::from(b))
        .ok_or(LogicError::Overflow)?
        / u128::from(d);
    u64::try_from(value).map_err(|_| LogicError::Overflow)
}

#[cfg(test)]
mod tests {
    use super::{split_pot, DamageRow};
    use crate::errors::LogicError;

    fn row(damage: u64, cleared: bool, age: u64, killer: bool) -> DamageRow {
        DamageRow {
            wallet: [1u8; 32],
            damage,
            cleared_t1: cleared,
            age_secs: age,
            killer,
        }
    }

    fn conserved(pot: u64, split: &super::Split) {
        let paid: u64 = split.amounts[..split.len].iter().sum();
        assert_eq!(paid.checked_add(split.unpaid), Some(pot));
    }

    #[test]
    fn one_slayer_is_capped_at_forty_percent() {
        let rows = [row(100, true, 90_000, true)];
        let split = split_pot(1_000, &rows, 86_400).unwrap();
        assert_eq!(split.amounts[0], 400);
        assert_eq!(split.unpaid, 600);
        conserved(1_000, &split);
    }

    #[test]
    fn a_young_wallet_misses_the_equal_share() {
        let rows = [row(100, true, 10, true)];
        let split = split_pot(100, &rows, 86_400).unwrap();
        assert_eq!(split.amounts[0], 40);
        conserved(100, &split);
    }

    #[test]
    fn two_even_slayers_cap_and_the_missing_killer_pool_stays_unpaid() {
        let rows = [row(50, true, 90_000, false), row(50, true, 90_000, false)];
        let split = split_pot(100, &rows, 86_400).unwrap();
        assert_eq!(split.amounts[0], 40);
        assert_eq!(split.amounts[1], 40);
        assert_eq!(split.unpaid, 20);
        conserved(100, &split);
    }

    #[test]
    fn exactly_two_percent_qualifies_and_one_percent_does_not() {
        let rows = [
            row(20, true, 90_000, false),
            row(10, true, 90_000, false),
            row(970, true, 90_000, true),
        ];
        let split = split_pot(10_000, &rows, 86_400).unwrap();
        conserved(10_000, &split);
        assert!(split.amounts.iter().all(|amount| *amount <= 4_000));
    }

    #[test]
    fn rejects_two_killers_and_too_many_rows() {
        let rows = [row(1, true, 1, true), row(1, true, 1, true)];
        assert_eq!(split_pot(10, &rows, 0), Err(LogicError::ManyKillers));
        let many = vec![row(1, true, 1, false); 65];
        assert_eq!(split_pot(10, &many, 0), Err(LogicError::TooManyRows));
    }

    #[test]
    fn zero_damage_pays_nothing() {
        let rows = [row(0, true, 90_000, true)];
        let split = split_pot(50, &rows, 0).unwrap();
        assert_eq!(split.amounts[0], 0);
        assert_eq!(split.unpaid, 50);
    }
}
