use crate::errors::LogicError;

use super::ids::{
    KIND_COAL, KIND_FOOD, KIND_ORE, KIND_STONE, KIND_WOOD, NODE_BERRY, NODE_BIRCH, NODE_COAL,
    NODE_ORE, NODE_ROCK,
};
use super::numbers::{
    ABERRATION_WORTH, AURORA_ABERRATION_PPM, AURORA_CYCLE_SECS, AURORA_UP_SECS,
    CLEAR_ABERRATION_PPM, ENERGY_MAX, ENERGY_REFILL_SECS, FATIGUE_HALF, FATIGUE_QUARTER,
    GATHER_COOLDOWN_SECS, GATHER_RANGE_UNITS,
};
use super::roll::ppm_of;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GatherBase {
    pub energy: u32,
    pub kind: u16,
    pub qty: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GatherExtra {
    pub kind: u16,
    pub qty: u32,
    pub aberration: bool,
}

struct NodeSpec {
    energy: u32,
    kind: u16,
    qty: u32,
}

pub fn gather_base(node: u8, energy_used_today: u32) -> Result<GatherBase, LogicError> {
    let spec = node_spec(node)?;
    Ok(GatherBase {
        energy: spec.energy,
        kind: spec.kind,
        qty: apply_fatigue(spec.qty, energy_used_today)?,
    })
}

pub fn gather_callback(
    node: u8,
    energy_used_today: u32,
    vrf: &[u8; 32],
    aurora_up: bool,
) -> Result<GatherExtra, LogicError> {
    let spec = node_spec(node)?;
    let threshold = if aurora_up {
        AURORA_ABERRATION_PPM
    } else {
        CLEAR_ABERRATION_PPM
    };
    let roll = ppm_of(u32::from_le_bytes([vrf[0], vrf[1], vrf[2], vrf[3]]));
    if roll >= threshold {
        return Ok(GatherExtra {
            kind: spec.kind,
            qty: 0,
            aberration: false,
        });
    }
    let raw = spec
        .qty
        .checked_mul(ABERRATION_WORTH)
        .ok_or(LogicError::Overflow)?;
    Ok(GatherExtra {
        kind: spec.kind,
        qty: apply_fatigue(raw, energy_used_today)?,
        aberration: true,
    })
}

pub fn in_gather_range(px: u16, py: u16, nx: u16, ny: u16) -> bool {
    let dx = i32::from(px) - i32::from(nx);
    let dy = i32::from(py) - i32::from(ny);
    dx * dx + dy * dy <= GATHER_RANGE_UNITS * GATHER_RANGE_UNITS
}

/// The aurora is up for the first 10 minutes of every 30, on the shared unix clock.
pub fn aurora_up(now_unix: i64) -> bool {
    if now_unix < 0 {
        return false;
    }
    now_unix % AURORA_CYCLE_SECS < AURORA_UP_SECS
}

pub fn cooldown_ready(last_unix: i64, now_unix: i64) -> bool {
    match now_unix.checked_sub(last_unix) {
        Some(delta) => delta >= GATHER_COOLDOWN_SECS,
        None => false,
    }
}

/// Refills 1 energy per 36 s, capped at 100. Time spent already full is not banked.
pub fn refill_energy(stored: u32, last_unix: i64, now_unix: i64) -> Result<(u32, i64), LogicError> {
    if stored > ENERGY_MAX {
        return Err(LogicError::BadEnergy);
    }
    // A clock step backwards is not an error: keep the stored bar and the old timestamp.
    if now_unix < last_unix {
        return Ok((stored, last_unix));
    }
    let elapsed = now_unix
        .checked_sub(last_unix)
        .ok_or(LogicError::Overflow)?;
    let elapsed = u64::try_from(elapsed).map_err(|_| LogicError::Overflow)?;
    let period = u64::try_from(ENERGY_REFILL_SECS).map_err(|_| LogicError::Overflow)?;
    let room = ENERGY_MAX - stored;
    let gained = match u32::try_from(elapsed / period) {
        Ok(steps) => steps.min(room),
        Err(_) => room,
    };
    let remainder = i64::try_from(elapsed % period).map_err(|_| LogicError::Overflow)?;
    let new_last = now_unix
        .checked_sub(remainder)
        .ok_or(LogicError::Overflow)?;
    Ok((stored + gained, new_last))
}

pub(crate) fn apply_fatigue(qty: u32, energy_used_today: u32) -> Result<u32, LogicError> {
    let bp: u32 = if energy_used_today >= FATIGUE_QUARTER {
        2_500
    } else if energy_used_today >= FATIGUE_HALF {
        5_000
    } else {
        10_000
    };
    let scaled = u64::from(qty)
        .checked_mul(u64::from(bp))
        .ok_or(LogicError::Overflow)?
        / 10_000;
    u32::try_from(scaled).map_err(|_| LogicError::Overflow)
}

fn node_spec(node: u8) -> Result<NodeSpec, LogicError> {
    match node {
        NODE_BIRCH => Ok(NodeSpec {
            energy: 1,
            kind: KIND_WOOD,
            qty: 1,
        }),
        NODE_ROCK => Ok(NodeSpec {
            energy: 1,
            kind: KIND_STONE,
            qty: 1,
        }),
        NODE_COAL => Ok(NodeSpec {
            energy: 1,
            kind: KIND_COAL,
            qty: 1,
        }),
        NODE_ORE => Ok(NodeSpec {
            energy: 3,
            kind: KIND_ORE,
            qty: 1,
        }),
        NODE_BERRY => Ok(NodeSpec {
            energy: 1,
            kind: KIND_FOOD,
            qty: 1,
        }),
        _ => Err(LogicError::BadNode),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        aurora_up, cooldown_ready, gather_base, gather_callback, in_gather_range, refill_energy,
    };
    use crate::errors::LogicError;
    use crate::logic::ids::{KIND_ORE, KIND_WOOD, NODE_BIRCH, NODE_ORE};

    #[test]
    fn costs_and_fatigue() {
        let birch = gather_base(NODE_BIRCH, 0).unwrap();
        assert_eq!(birch.energy, 1);
        assert_eq!(birch.kind, KIND_WOOD);
        assert_eq!(birch.qty, 1);
        assert_eq!(gather_base(NODE_ORE, 0).unwrap().energy, 3);
        assert_eq!(gather_base(NODE_ORE, 0).unwrap().kind, KIND_ORE);
        assert_eq!(gather_base(NODE_BIRCH, 499).unwrap().qty, 1);
        assert_eq!(gather_base(NODE_BIRCH, 500).unwrap().qty, 0);
        assert!(gather_base(9, 0).is_err());
    }

    #[test]
    fn range_and_cooldown() {
        assert!(in_gather_range(0, 0, 24, 0));
        assert!(!in_gather_range(0, 0, 25, 0));
        assert!(in_gather_range(0, 0, 16, 16));
        assert!(!in_gather_range(0, 0, 17, 17));
        assert!(cooldown_ready(7, 10));
        assert!(!cooldown_ready(8, 10));
        assert!(!cooldown_ready(10, 9));
        assert!(aurora_up(0));
        assert!(aurora_up(599));
        assert!(!aurora_up(600));
        assert!(aurora_up(1_800));
        assert!(!aurora_up(-1));
    }

    #[test]
    fn aberration_pays_twenty_then_fatigue_and_a_high_roll_pays_nothing() {
        let mut vrf = [0u8; 32];
        let hit = gather_callback(NODE_BIRCH, 0, &vrf, false).unwrap();
        assert!(hit.aberration);
        assert_eq!(hit.qty, 20);
        assert_eq!(hit.kind, KIND_WOOD);

        let tired = gather_callback(NODE_BIRCH, 500, &vrf, false).unwrap();
        assert_eq!(tired.qty, 10);

        vrf[0] = 0xff;
        vrf[1] = 0xff;
        vrf[2] = 0xff;
        vrf[3] = 0xff;
        let miss = gather_callback(NODE_BIRCH, 0, &vrf, true).unwrap();
        assert!(!miss.aberration);
        assert_eq!(miss.qty, 0);
    }

    #[test]
    fn refill_caps_and_does_not_bank_time_spent_full() {
        assert_eq!(refill_energy(99, 0, 36), Ok((100, 36)));
        assert_eq!(refill_energy(100, 0, 3_600), Ok((100, 3_600)));
        assert_eq!(refill_energy(50, 0, 2_170), Ok((100, 2_160)));
        assert_eq!(refill_energy(0, 100, 50), Ok((0, 100)));
        assert_eq!(refill_energy(101, 0, 36), Err(LogicError::BadEnergy));
    }
}
