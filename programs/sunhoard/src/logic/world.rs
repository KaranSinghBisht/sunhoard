//! The season clock: phase transitions, Pell's Wants, bounties and the
//! First Light window. Pure rules; the crank calls them.

use crate::errors::LogicError;

use super::numbers::{
    BP, FIRST_LIGHT_DEMO_SECS, FIRST_LIGHT_LIVE_SECS, LONG_NIGHT_DEMO_SECS, LONG_NIGHT_LIVE_SECS,
    PHASE_LONG_NIGHT, PHASE_SPRING, SPRING_DEMO_SECS, SPRING_LIVE_SECS, WANTS_HOUR_SECS,
};
use super::roll::expand;

/// The world crank ticks at most once per minute.
pub const WORLD_TICK_SECS: i64 = 60;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WorldTick {
    /// The phase now, after the transition check.
    pub phase: u8,
    /// Whether the Long Night just ended with Old Gloam alive.
    pub survived: bool,
    /// The new Wants, when the hour rolled over: (good_a, good_b).
    pub wants: Option<(u16, u16)>,
    /// The bounty kinds, when the day rolled over.
    pub bounties: Option<[u16; 3]>,
}

/// Advances the season clock one step. Returns what changed.
pub fn tick_world(
    phase: u8,
    phase_started: i64,
    phase_ends: i64,
    demo: bool,
    now: i64,
    last_rotation: i64,
    salt: &[u8; 32],
    season_number: u32,
) -> Result<WorldTick, LogicError> {
    let mut out = WorldTick {
        phase,
        survived: false,
        wants: None,
        bounties: None,
    };
    let mut current = phase;
    if current == PHASE_LONG_NIGHT && now >= phase_ends {
        current = PHASE_SPRING;
        out.survived = true;
    }
    out.phase = current;
    let (night_len, spring_len, _first_light) = if demo {
        (LONG_NIGHT_DEMO_SECS, SPRING_DEMO_SECS, FIRST_LIGHT_DEMO_SECS)
    } else {
        (LONG_NIGHT_LIVE_SECS, SPRING_LIVE_SECS, FIRST_LIGHT_LIVE_SECS)
    };
    let _ = (night_len, spring_len, phase_started, season_number);
    // Pell's Wants rotate once an hour; bounties once a day.
    if last_rotation > 0 && now - last_rotation >= WANTS_HOUR_SECS {
        let hour = now / WANTS_HOUR_SECS;
        let (a, b) = pick_two(salt, hour);
        out.wants = Some((a, b));
        if hour % 24 == 0 {
            out.bounties = Some(pick_bounties(salt, hour));
        }
    }
    Ok(out)
}

/// True during Spring's first hour (1 minute in demo): no Hearth Penny.
pub fn first_light(phase: u8, phase_started: i64, demo: bool, now: i64) -> bool {
    if phase != PHASE_SPRING {
        return false;
    }
    let window = if demo {
        FIRST_LIGHT_DEMO_SECS
    } else {
        FIRST_LIGHT_LIVE_SECS
    };
    now.saturating_sub(phase_started) < window
}

/// Half the pot burns, half carries over.
pub fn survive_pot(pot: u64) -> Result<(u64, u64), LogicError> {
    let carries = pot / 2;
    let burned = pot - carries;
    Ok((carries, burned))
}

/// Two Wants from the goods Pell buys, deterministic from the salt and hour.
pub fn pick_two(salt: &[u8; 32], hour: i64) -> (u16, u16) {
    let pool: [u16; 7] = [1, 2, 3, 4, 5, 7, 8];
    let roll = expand(salt, hour as u64);
    let first = pool[usize::from(roll[0] % 7)];
    let second = pool[usize::from(roll[1] % 7)];
    if first == second {
        let third = pool[usize::from(roll[2] % 7)];
        return (first, third);
    }
    (first, second)
}

/// Three bounty kinds a day, deterministic from the salt and hour.
pub fn pick_bounties(salt: &[u8; 32], hour: i64) -> [u16; 3] {
    let pool: [u16; 5] = [1, 2, 3, 4, 5];
    let roll = expand(salt, hour as u64 ^ 0x9e3779b9);
    [
        pool[usize::from(roll[0] % 5)],
        pool[usize::from(roll[1] % 5)],
        pool[usize::from(roll[2] % 5)],
    ]
}

/// The value of a warmth point in basis points of the output bonus, capped.
pub fn warmth_bonus_bp(warmth_x100: u16) -> u32 {
    // +1% per warmth point, at most +50%.
    let points = u32::from(warmth_x100) / 100;
    points.min(50) * 100
}

/// A block's warmth in hundredths: grade base × (0.5 + purity).
pub fn block_warmth(grade: u8, purity_bp: u16) -> Result<u16, LogicError> {
    let base: u64 = match grade {
        0 => 100,
        1 => 200,
        2 => 400,
        3 => 800,
        4 => 1_600,
        _ => return Err(LogicError::BadRarity),
    };
    let factor = u64::from(BP) / 2 + u64::from(purity_bp.min(10_000));
    base.checked_mul(factor)
        .map(|scaled| scaled / u64::from(BP))
        .and_then(|warmth| u16::try_from(warmth).ok())
        .ok_or(LogicError::Overflow)
}

#[cfg(test)]
mod tests {
    use super::{block_warmth, first_light, pick_two, survive_pot, tick_world};
    use crate::logic::numbers::{LONG_NIGHT_LIVE_SECS, PHASE_LONG_NIGHT, PHASE_SPRING};

    #[test]
    fn the_clock_survives_the_long_night() {
        let start = 1_700_000_000;
        let ends = start + LONG_NIGHT_LIVE_SECS;
        let out = tick_world(PHASE_LONG_NIGHT, start, ends, false, ends + 1, 0, &[0u8; 32], 1).unwrap();
        assert_eq!(out.phase, PHASE_SPRING);
        assert!(out.survived);
        assert_eq!(survive_pot(1_000), Ok((500, 500)));
        assert_eq!(survive_pot(7), Ok((3, 4)));
    }

    #[test]
    fn first_light_only_guards_springs_first_hour() {
        assert!(first_light(PHASE_SPRING, 100, false, 100 + 3_599));
        assert!(!first_light(PHASE_SPRING, 100, false, 100 + 3_600));
        assert!(!first_light(PHASE_LONG_NIGHT, 100, false, 101));
        assert!(first_light(PHASE_SPRING, 100, true, 100 + 59));
        assert!(!first_light(PHASE_SPRING, 100, true, 100 + 60));
    }

    #[test]
    fn wants_rotate_hourly_and_warmth_scales() {
        let (a, b) = pick_two(&[7u8; 32], 42);
        assert!(a != b);
        assert!(block_warmth(0, 10_000).unwrap() >= block_warmth(0, 0).unwrap());
        assert_eq!(block_warmth(4, 0).unwrap(), 800);
    }
}
