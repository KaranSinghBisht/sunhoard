use crate::errors::LogicError;

use super::ids::{
    KIND_COAL, KIND_FOOD, KIND_ORE, KIND_STONE, KIND_WOOD, NODE_BERRY, NODE_BIRCH, NODE_COAL,
    NODE_ORE, NODE_ROCK,
};
use super::numbers::{
    ABERRATION_WORTH, AURORA_ABERRATION_PPM, AURORA_CYCLE_SECS, AURORA_UP_SECS, BP,
    CLEAR_ABERRATION_PPM, ENERGY_MAX, ENERGY_REFILL_SECS, FATIGUE_HALF, FATIGUE_QUARTER,
    GATHER_COOLDOWN_SECS, GATHER_RANGE_UNITS,
};
use super::roll::ppm_of;

/// A tool's gathering traits: Efficient cuts energy, Bountiful adds yield.
/// Values are basis points; 0 means no trait.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct ToolBonus {
    pub efficient_bp: u32,
    pub bountiful_bp: u32,
}

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

pub fn gather_base(node: u8, energy_used_today: u32, tool: ToolBonus) -> Result<GatherBase, LogicError> {
    let spec = node_spec(node)?;
    let energy = apply_efficient(spec.energy, tool.efficient_bp)?;
    Ok(GatherBase {
        energy,
        kind: spec.kind,
        qty: apply_bountiful(apply_fatigue(spec.qty, energy_used_today)?, tool.bountiful_bp)?,
    })
}

pub fn gather_callback(
    node: u8,
    energy_used_today: u32,
    tool: ToolBonus,
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
    let tired = apply_fatigue(raw, energy_used_today)?;
    Ok(GatherExtra {
        kind: spec.kind,
        qty: apply_bountiful(tired, tool.bountiful_bp)?,
        aberration: true,
    })
}

/// Efficient cuts the energy cost: −6/−15/−25% at tiers I/III/V, never below 1.
fn apply_efficient(energy: u32, efficient_bp: u32) -> Result<u32, LogicError> {
    if efficient_bp > BP {
        return Err(LogicError::BadAmount);
    }
    let cut = u64::from(energy)
        .checked_mul(u64::from(BP - efficient_bp))
        .ok_or(LogicError::Overflow)?
        / u64::from(BP);
    Ok(u32::try_from(cut).unwrap_or(1).max(1))
}

/// Bountiful adds yield: +10/+25/+40% at tiers I/III/V.
fn apply_bountiful(qty: u32, bountiful_bp: u32) -> Result<u32, LogicError> {
    if bountiful_bp > BP {
        return Err(LogicError::BadAmount);
    }
    let grown = u64::from(qty)
        .checked_mul(u64::from(BP + bountiful_bp))
        .ok_or(LogicError::Overflow)?
        / u64::from(BP);
    u32::try_from(grown).map_err(|_| LogicError::Overflow)
}

/// The public map stores tile coordinates; action positions use sixteenths of a tile.
pub fn canonical_node(node: u8, zone: u8) -> Option<(u16, u16)> {
    if zone != 0 {
        return None;
    }
    let &(col, row) = crate::constants::GATHER_TILES.get(usize::from(node))?;
    Some((col.checked_mul(16)?.checked_add(8)?, row.checked_add(1)?.checked_mul(16)?))
}

pub fn in_gather_range(px: u16, py: u16, nx: u16, ny: u16) -> bool {
    let dx = i64::from(px) - i64::from(nx);
    let dy = i64::from(py) - i64::from(ny);
    dx * dx + dy * dy <= i64::from(GATHER_RANGE_UNITS).pow(2)
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
        ToolBonus,
    };
    use crate::errors::LogicError;
    use crate::logic::ids::{KIND_ORE, KIND_WOOD, NODE_BIRCH, NODE_ORE};

    const NONE: ToolBonus = ToolBonus {
        efficient_bp: 0,
        bountiful_bp: 0,
    };

    #[test]
    fn costs_and_fatigue() {
        let birch = gather_base(NODE_BIRCH, 0, NONE).unwrap();
        assert_eq!(birch.energy, 1);
        assert_eq!(birch.kind, KIND_WOOD);
        assert_eq!(birch.qty, 1);
        assert_eq!(gather_base(NODE_ORE, 0, NONE).unwrap().energy, 3);
        assert_eq!(gather_base(NODE_ORE, 0, NONE).unwrap().kind, KIND_ORE);
        assert_eq!(gather_base(NODE_BIRCH, 499, NONE).unwrap().qty, 1);
        assert_eq!(gather_base(NODE_BIRCH, 500, NONE).unwrap().qty, 0);
        assert!(gather_base(9, 0, NONE).is_err());
    }

    #[test]
    fn tools_move_the_numbers() {
        let efficient = ToolBonus {
            efficient_bp: 1_500,
            bountiful_bp: 0,
        };
        let ore = gather_base(NODE_ORE, 0, efficient).unwrap();
        // 3 energy × 0.85 = 2.55 → 2.
        assert_eq!(ore.energy, 2);

        let bountiful = ToolBonus {
            efficient_bp: 0,
            bountiful_bp: 2_500,
        };
        assert_eq!(gather_base(NODE_BIRCH, 0, bountiful).unwrap().qty, 1);
        assert_eq!(gather_base(NODE_BIRCH, 499, bountiful).unwrap().qty, 1);
        assert_eq!(gather_base(NODE_BIRCH, 500, bountiful).unwrap().qty, 0);
        let vrf = [0u8; 32];
        let hit = gather_callback(NODE_BIRCH, 0, bountiful, &vrf, false).unwrap();
        // 20 × 1.25 = 25.
        assert_eq!(hit.qty, 25);
    }

    #[test]
    fn range_and_cooldown() {
        assert_eq!(super::canonical_node(NODE_BIRCH, 0), Some((376, 240)));
        assert_eq!(super::canonical_node(NODE_BIRCH, 1), None);
        assert_eq!(super::canonical_node(u8::MAX, 0), None);
        assert!(!in_gather_range(u16::MAX, u16::MAX, 0, 0));
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
        let hit = gather_callback(NODE_BIRCH, 0, NONE, &vrf, false).unwrap();
        assert!(hit.aberration);
        assert_eq!(hit.qty, 20);
        assert_eq!(hit.kind, KIND_WOOD);

        let tired = gather_callback(NODE_BIRCH, 500, NONE, &vrf, false).unwrap();
        assert_eq!(tired.qty, 10);

        vrf[0] = 0xff;
        vrf[1] = 0xff;
        vrf[2] = 0xff;
        vrf[3] = 0xff;
        let miss = gather_callback(NODE_BIRCH, 0, NONE, &vrf, true).unwrap();
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
