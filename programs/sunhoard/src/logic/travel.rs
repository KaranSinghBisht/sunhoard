//! Overworld speed. Combat speed is 8 units per 100 ms step, so 80 units a second.

use super::numbers::PLAYER_SPEED;

pub const MAX_ZONE: u8 = 5;

pub fn move_allowed(
    from_x: u16,
    from_y: u16,
    to_x: u16,
    to_y: u16,
    dt_secs: i64,
    zone_changed: bool,
) -> bool {
    if zone_changed {
        return true;
    }
    if dt_secs < 0 {
        return false;
    }
    let max = dt_secs.saturating_mul(i64::from(PLAYER_SPEED) * 10);
    let dx = i64::from(from_x) - i64::from(to_x);
    let dy = i64::from(from_y) - i64::from(to_y);
    dx.saturating_mul(dx).saturating_add(dy.saturating_mul(dy)) <= max.saturating_mul(max)
}

#[cfg(test)]
mod tests {
    use super::move_allowed;

    #[test]
    fn speed_matches_eighty_units_a_second() {
        assert!(move_allowed(0, 0, 80, 0, 1, false));
        assert!(!move_allowed(0, 0, 81, 0, 1, false));
        assert!(move_allowed(0, 0, 0, 0, 0, false));
        assert!(!move_allowed(0, 0, 1, 0, -1, false));
        assert!(move_allowed(0, 0, 400, 400, 0, true));
    }
}
