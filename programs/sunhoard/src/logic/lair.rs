//! The Noonless Crater: one visit, three phases, one coil of Old Gloam.
//! Damage drains the shared World HP; sparks spill the Sunhoard in the Gloaming.

use crate::errors::LogicError;

use super::arena::{Body, Intent, Monster, Shot};
use super::combat::{attack_damage, Weapon};
use super::math::isqrt;
use super::numbers::{BP, PLAYER_HP, SHOT_SLOTS};
use super::roll::expand;

pub const GLOAM: u8 = 4;
pub const PHASE_RIME: u8 = 0;
pub const PHASE_GLOAMING: u8 = 1;
pub const PHASE_NOON: u8 = 2;
/// Rime 60 s, Gloaming 60 s, Noon 30 s at double speed. Steps of 100 ms.
pub const RIME_STEPS: u64 = 600;
pub const GLOAMING_STEPS: u64 = 600;
pub const NOON_STEPS: u64 = 300;
/// The visit's total length in steps.
pub const VISIT_STEPS: u64 = RIME_STEPS + GLOAMING_STEPS + NOON_STEPS;
/// Damage flushes to World every 5 steps (0.5 s).
pub const FLUSH_STEPS: u64 = 5;
/// The Glare mark multiplies the keeper's damage by 1.5.
pub const MARK_DAMAGE_BP: u64 = 15_000;
/// A marked keeper takes 30% more from every attack.
pub const MARK_TAKEN_BP: u64 = 13_000;
/// A keeper needs at least 500 Glints to draw the Glare.
pub const GLARE_MIN_HUNDREDTHS: u64 = 50_000;
/// Every 10th hit in the Gloaming spills a spark.
pub const SPARK_EVERY: u8 = 10;
/// A spark holds 0.05% of the pot, at most 10 Glints.
pub const SPARK_POT_PPM: u64 = 500;
pub const SPARK_MAX_HUNDREDTHS: u64 = 1_000;
/// A spark not scooped within 3 s drifts back.
pub const SPARK_LIFE: u8 = 30;
/// The lantern circles: four fixed posts.
pub const LANTERNS: [(i32, i32); 4] = [(64, 64), (192, 64), (64, 192), (192, 192)];
pub const LIGHT_RADIUS: i32 = 36;
/// The keeper scoops a spark within this distance.
pub const SCOOP_RADIUS: i32 = 16;

pub const SHOT_FROST: u8 = 3;
pub const SHOT_STONE: u8 = 4;
pub const SHOT_BEAM: u8 = 5;
pub const SHOT_RAY: u8 = 6;

pub const ATTACK_BREATH: u8 = 1;
pub const ATTACK_HAIL: u8 = 2;
pub const ATTACK_BEAM: u8 = 3;
pub const ATTACK_TAIL: u8 = 4;
pub const ATTACK_DASH: u8 = 5;
pub const ATTACK_SUNBURST: u8 = 6;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LairSim {
    pub step_index: u64,
    pub room_w: i32,
    pub room_h: i32,
    pub player: Body,
    pub boss: Monster,
    pub shots: [Shot; SHOT_SLOTS],
    pub shot_count: u8,
    pub sparks: [Shot; SHOT_SLOTS],
    pub spark_count: u8,
    pub phase: u8,
    pub phase_step: u64,
    pub attack: u8,
    pub telegraph: u8,
    pub cd: u8,
    pub hits: u8,
    pub marked: bool,
    /// Damage since the last flush, already scaled by the mark.
    pub unflushed: u64,
    pub spark_value: u32,
    pub spark_heal: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LairStep {
    /// The counted damage this step (already ×1.5 when marked).
    pub damage: u64,
    /// A spark spilled this step: its value and the heal if it is missed.
    pub spilled: Option<(u64, u64)>,
    /// Sparks drifted back this step: the total Gloam heal.
    pub drifted: u64,
    /// The visit ended this step (Noon is over or the keeper fell).
    pub done: bool,
}

pub fn open_lair(seed: &[u8; 32], marked: bool) -> Result<LairSim, LogicError> {
    let mut boss = Monster::empty();
    boss.kind = GLOAM;
    boss.body = Body::at(128, 96, 1);
    boss.aim_x = 128;
    boss.aim_y = 96;
    let _ = seed;
    Ok(LairSim {
        step_index: 0,
        room_w: 256,
        room_h: 256,
        player: Body::at(128, 224, PLAYER_HP),
        boss,
        shots: [Shot::empty(); SHOT_SLOTS],
        shot_count: 0,
        sparks: [Shot::empty(); SHOT_SLOTS],
        spark_count: 0,
        phase: PHASE_RIME,
        phase_step: 0,
        attack: 0,
        telegraph: 0,
        cd: 0,
        hits: 0,
        marked,
        unflushed: 0,
        spark_value: 0,
        spark_heal: 0,
    })
}

pub fn step_lair(
    sim: &mut LairSim,
    intent: Intent,
    seed: &[u8; 32],
    weapon: &Weapon,
    pot: u64,
) -> Result<LairStep, LogicError> {
    let mut out = LairStep {
        damage: 0,
        spilled: None,
        drifted: 0,
        done: false,
    };
    if sim.player.hp <= 0 {
        sim.step_index += 1;
        out.done = true;
        return Ok(out);
    }
    if sim.phase_step >= VISIT_STEPS {
        out.done = true;
        return Ok(out);
    }
    tick_body(&mut sim.player);
    begin_dash(&mut sim.player, &intent);
    let speed = if sim.player.dash_left > 0 {
        super::numbers::DASH_SPEED
    } else {
        super::numbers::PLAYER_SPEED
    };
    move_cardinal(&mut sim.player, intent.dx, intent.dy, speed, sim.room_w, sim.room_h)?;
    step_phases(sim, seed, pot)?;
    swing(sim, intent, seed, weapon, pot, &mut out)?;
    step_shots(sim)?;
    let expired = expire_sparks(sim)?;
    if expired > 0 {
        out.drifted = u64::from(sim.spark_heal).saturating_mul(expired as u64);
    }
    sim.step_index += 1;
    Ok(out)
}

fn step_phases(sim: &mut LairSim, seed: &[u8; 32], pot: u64) -> Result<(), LogicError> {
    sim.phase_step += 1;
    sim.phase = if sim.phase_step <= RIME_STEPS {
        PHASE_RIME
    } else if sim.phase_step <= RIME_STEPS + GLOAMING_STEPS {
        PHASE_GLOAMING
    } else {
        PHASE_NOON
    };
    // The Gloaming's dark gnaws outside the lantern circles.
    if sim.phase == PHASE_GLOAMING
        && sim.phase_step % 5 == 0
        && !in_light(sim.player.x, sim.player.y)
    {
        sim.player.hp = sim.player.hp.saturating_sub(1);
    }
    let gap: u8 = if sim.phase == PHASE_NOON { 30 } else { 50 };
    if sim.telegraph > 0 {
        sim.telegraph -= 1;
        if sim.telegraph == 0 {
            fire(sim, seed)?;
        }
        return Ok(());
    }
    if sim.cd > 0 {
        sim.cd -= 1;
    }
    if sim.cd == 0 {
        sim.attack = pick_attack(sim, seed);
        sim.telegraph = 6;
        sim.cd = gap;
    }
    let _ = pot;
    Ok(())
}

fn pick_attack(sim: &LairSim, seed: &[u8; 32]) -> u8 {
    let roll = word0(&expand(seed, sim.step_index)) % 3;
    match sim.phase {
        PHASE_RIME => match roll {
            0 => ATTACK_BREATH,
            2 if sim.marked => ATTACK_BEAM,
            _ => ATTACK_HAIL,
        },
        PHASE_GLOAMING => match roll {
            0 => ATTACK_TAIL,
            _ => ATTACK_HAIL,
        },
        _ => match roll {
            0 => ATTACK_DASH,
            1 => ATTACK_SUNBURST,
            _ => ATTACK_HAIL,
        },
    }
}

fn fire(sim: &mut LairSim, seed: &[u8; 32]) -> Result<(), LogicError> {
    let (px, py) = (sim.player.x, sim.player.y);
    let (bx, by) = (sim.boss.body.x, sim.boss.body.y);
    match sim.attack {
        ATTACK_BREATH => {
            let (vx, vy) = aim(px, py, bx, by, 3);
            add_shot(sim, bx, by, vx, vy, 120, SHOT_FROST)
        }
        ATTACK_HAIL => {
            for offset in [-24, 0, 24] {
                let (vx, vy) = aim(px + offset, py, bx, by, 5);
                add_shot(sim, bx, by, vx, vy, 60, SHOT_STONE)?;
            }
            Ok(())
        }
        ATTACK_BEAM => {
            let (vx, vy) = aim(px, py, bx, by, 8);
            add_shot(sim, bx, by, vx, vy, 40, SHOT_BEAM)
        }
        ATTACK_TAIL => {
            if dist2(bx, by, px, py) <= 28 * 28 {
                sim.player.hp = sim.player.hp.saturating_sub(scale_taken(sim, 20));
            }
            Ok(())
        }
        ATTACK_DASH => {
            sim.boss.body.x = (px - 12).clamp(0, sim.room_w);
            sim.boss.body.y = (py - 12).clamp(0, sim.room_h);
            if dist2(sim.boss.body.x, sim.boss.body.y, px, py) <= 20 * 20 {
                sim.player.hp = sim.player.hp.saturating_sub(scale_taken(sim, 25));
            }
            Ok(())
        }
        ATTACK_SUNBURST => {
            for (vx, vy) in [(4, 0), (-4, 0), (0, 4), (0, -4)] {
                add_shot(sim, bx, by, vx, vy, 60, SHOT_RAY)?;
            }
            Ok(())
        }
        _ => {
            let _ = seed;
            Ok(())
        }
    }
}

fn swing(
    sim: &mut LairSim,
    intent: Intent,
    seed: &[u8; 32],
    weapon: &Weapon,
    pot: u64,
    out: &mut LairStep,
) -> Result<(), LogicError> {
    if !intent.attack || sim.player.attack_cd > 0 {
        return Ok(());
    }
    sim.player.attack_cd = super::numbers::ATTACK_STEPS;
    if !in_arc(sim.player, sim.boss.body.x, sim.boss.body.y) {
        return Ok(());
    }
    let dealt = attack_damage(weapon, seed, sim.step_index, 0)?;
    if dealt <= 0 {
        return Ok(());
    }
    let counted = u64::try_from(dealt)
        .unwrap_or(0)
        .checked_mul(if sim.marked { MARK_DAMAGE_BP } else { u64::from(BP) })
        .ok_or(LogicError::Overflow)?
        / u64::from(BP);
    sim.unflushed = sim.unflushed.checked_add(counted).ok_or(LogicError::Overflow)?;
    out.damage = counted;
    sim.hits = sim.hits.saturating_add(1);
    if sim.phase == PHASE_GLOAMING && sim.hits % SPARK_EVERY == 0 {
        let value = pot
            .checked_mul(SPARK_POT_PPM)
            .ok_or(LogicError::Overflow)?
            / 1_000_000;
        let value = value.min(SPARK_MAX_HUNDREDTHS);
        spawn_spark(sim, value, counted)?;
        out.spilled = Some((value, counted));
    }
    Ok(())
}

fn spawn_spark(sim: &mut LairSim, value: u64, heal: u64) -> Result<(), LogicError> {
    let index = usize::from(sim.spark_count);
    if index >= SHOT_SLOTS {
        return Err(LogicError::Full);
    }
    sim.sparks[index] = Shot {
        x: sim.boss.body.x,
        y: sim.boss.body.y,
        vx: 0,
        vy: 0,
        life: SPARK_LIFE,
        kind: 0,
    };
    sim.spark_count += 1;
    sim.spark_value = u32::try_from(value).unwrap_or(u32::MAX);
    sim.spark_heal = u32::try_from(heal).unwrap_or(u32::MAX);
    Ok(())
}

fn step_shots(sim: &mut LairSim) -> Result<(), LogicError> {
    let mut live = 0usize;
    for index in 0..usize::from(sim.shot_count) {
        let shot = sim.shots[index];
        if shot.life == 0 {
            continue;
        }
        let mut next = shot;
        next.x += i32::from(next.vx);
        next.y += i32::from(next.vy);
        next.life = next.life.saturating_sub(1);
        let outside = next.x < 0 || next.y < 0 || next.x > sim.room_w || next.y > sim.room_h || next.life == 0;
        if outside {
            continue;
        }
        if dist2(sim.player.x, sim.player.y, next.x, next.y) <= 100 {
            // The breath is harmless inside a lantern circle.
            let safe = next.kind == SHOT_FROST && in_light(sim.player.x, sim.player.y);
            if !safe {
                let dmg = match next.kind {
                    SHOT_FROST => 25,
                    SHOT_STONE => 10,
                    SHOT_BEAM => 30,
                    _ => 15,
                };
                sim.player.hp = sim.player.hp.saturating_sub(scale_taken(sim, dmg));
            }
            continue;
        }
        sim.shots[live] = next;
        live += 1;
    }
    for slot in sim.shots.iter_mut().skip(live) {
        *slot = Shot::empty();
    }
    sim.shot_count = live as u8;
    Ok(())
}

fn expire_sparks(sim: &mut LairSim) -> Result<usize, LogicError> {
    let mut expired = 0usize;
    let mut live = 0usize;
    for index in 0..usize::from(sim.spark_count) {
        let mut spark = sim.sparks[index];
        if spark.life == 0 {
            continue;
        }
        spark.life = spark.life.saturating_sub(1);
        if spark.life == 0 {
            expired += 1;
            continue; // Drifted back: the caller heals Gloam with spark_heal.
        }
        sim.sparks[live] = spark;
        live += 1;
    }
    for slot in sim.sparks.iter_mut().skip(live) {
        *slot = Shot::empty();
    }
    sim.spark_count = live as u8;
    Ok(expired)
}

/// True when a spark can still be scooped, and which one it is.
pub fn scoopable(sim: &LairSim, px: i32, py: i32) -> Option<usize> {
    for index in 0..usize::from(sim.spark_count) {
        let spark = &sim.sparks[index];
        if spark.life == 0 {
            continue;
        }
        if dist2(px, py, spark.x, spark.y)
            <= i64::from(SCOOP_RADIUS) * i64::from(SCOOP_RADIUS)
        {
            return Some(index);
        }
    }
    None
}

pub fn in_light(px: i32, py: i32) -> bool {
    LANTERNS.iter().any(|(x, y)| {
        dist2(px, py, *x, *y) <= i64::from(LIGHT_RADIUS) * i64::from(LIGHT_RADIUS)
    })
}

fn scale_taken(sim: &LairSim, dmg: i32) -> i32 {
    if sim.marked {
        (i64::from(dmg) * MARK_TAKEN_BP as i64 / i64::from(BP)) as i32
    } else {
        dmg
    }
}

fn tick_body(body: &mut Body) {
    body.attack_cd = body.attack_cd.saturating_sub(1);
    body.invuln = body.invuln.saturating_sub(1);
    body.dash_cd = body.dash_cd.saturating_sub(1);
    body.dash_left = body.dash_left.saturating_sub(1);
    body.slow = body.slow.saturating_sub(1);
}

fn begin_dash(body: &mut Body, intent: &Intent) {
    if !intent.dash || body.dash_cd > 0 || body.dash_left > 0 {
        return;
    }
    body.dash_left = super::numbers::DASH_STEPS;
    body.dash_cd = super::numbers::DASH_COOLDOWN_STEPS;
    if body.invuln < super::numbers::DASH_STEPS {
        body.invuln = super::numbers::DASH_STEPS;
    }
}

fn move_cardinal(
    body: &mut Body,
    dx: i8,
    dy: i8,
    speed: i32,
    room_w: i32,
    room_h: i32,
) -> Result<(), LogicError> {
    let (sx, sy) = axis_step(i32::from(dx), i32::from(dy), speed);
    body.facing = facing_from(i32::from(dx), i32::from(dy), body.facing);
    body.x = (body.x + sx).clamp(0, room_w);
    body.y = (body.y + sy).clamp(0, room_h);
    Ok(())
}

fn axis_step(dx: i32, dy: i32, speed: i32) -> (i32, i32) {
    if dx == 0 && dy == 0 {
        return (0, 0);
    }
    let magnitude = if dx != 0 && dy != 0 {
        speed * super::numbers::DIAGONAL_NUM / super::numbers::DIAGONAL_DEN
    } else {
        speed
    };
    (dx.signum() * magnitude, dy.signum() * magnitude)
}

fn facing_from(dx: i32, dy: i32, current: u8) -> u8 {
    if dx == 0 && dy == 0 {
        return current;
    }
    if dx.abs() >= dy.abs() {
        if dx > 0 {
            0
        } else {
            2
        }
    } else if dy > 0 {
        1
    } else {
        3
    }
}

fn in_arc(player: Body, tx: i32, ty: i32) -> bool {
    let dx = i64::from(tx) - i64::from(player.x);
    let dy = i64::from(ty) - i64::from(player.y);
    let dist2 = dx * dx + dy * dy;
    let reach = i64::from(super::numbers::REACH_UNITS) * i64::from(super::numbers::REACH_UNITS);
    if dist2 == 0 {
        return true;
    }
    if dist2 > reach {
        return false;
    }
    let (fx, fy) = match player.facing {
        0 => (1, 0),
        1 => (0, 1),
        2 => (-1, 0),
        _ => (0, -1),
    };
    let dot = dx * fx + dy * fy;
    dot > 0 && dot * dot * 2 >= dist2
}

fn aim(tx: i32, ty: i32, fx: i32, fy: i32, speed: i32) -> (i16, i16) {
    let dx = i64::from(tx) - i64::from(fx);
    let dy = i64::from(ty) - i64::from(fy);
    let dist = isqrt(dx * dx + dy * dy);
    if dist == 0 {
        return (0, 0);
    }
    (
        i16::try_from((dx * i64::from(speed)) / dist).unwrap_or(0),
        i16::try_from((dy * i64::from(speed)) / dist).unwrap_or(0),
    )
}

fn add_shot(
    sim: &mut LairSim,
    x: i32,
    y: i32,
    vx: i16,
    vy: i16,
    life: u8,
    kind: u8,
) -> Result<(), LogicError> {
    let index = usize::from(sim.shot_count);
    if index >= SHOT_SLOTS {
        return Err(LogicError::Full);
    }
    sim.shots[index] = Shot {
        x,
        y,
        vx,
        vy,
        life,
        kind,
    };
    sim.shot_count += 1;
    Ok(())
}

fn dist2(ax: i32, ay: i32, bx: i32, by: i32) -> i64 {
    let dx = i64::from(ax) - i64::from(bx);
    let dy = i64::from(ay) - i64::from(by);
    dx * dx + dy * dy
}

fn word0(bytes: &[u8; 32]) -> u32 {
    u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
}

#[cfg(test)]
mod tests {
    use super::{
        in_light, open_lair, scoopable, step_lair, LairSim, PHASE_GLOAMING, PHASE_NOON,
        PHASE_RIME, VISIT_STEPS,
    };
    use crate::logic::arena::Intent;
    use crate::logic::stone_weapon;

    const STILL: Intent = Intent {
        dx: 0,
        dy: 0,
        attack: false,
        dash: false,
    };

    #[test]
    fn phases_advance_and_the_visit_ends() {
        let mut sim = open_lair(&[0u8; 32], false).unwrap();
        for _ in 0..VISIT_STEPS {
            let out = step_lair(&mut sim, STILL, &[0u8; 32], &stone_weapon(), 10_000).unwrap();
            if out.done {
                return;
            }
        }
        let out = step_lair(&mut sim, STILL, &[0u8; 32], &stone_weapon(), 10_000).unwrap();
        assert!(out.done);
    }

    #[test]
    fn marked_keepers_hit_harder() {
        let mut plain = open_lair(&[0u8; 32], false).unwrap();
        let mut marked = open_lair(&[0u8; 32], true).unwrap();
        let attack = Intent {
            dx: 0,
            dy: 0,
            attack: true,
            dash: false,
        };
        // Put the keeper next to the coil, facing it.
        for sim in [&mut plain, &mut marked] {
            sim.player.x = 128;
            sim.player.y = 112;
            sim.player.facing = 3;
        }
        let plain_hit = step_lair(&mut plain, attack, &[0u8; 32], &stone_weapon(), 10_000)
            .unwrap()
            .damage;
        let marked_hit = step_lair(&mut marked, attack, &[0u8; 32], &stone_weapon(), 10_000)
            .unwrap()
            .damage;
        assert!(plain_hit > 0);
        assert_eq!(marked_hit, plain_hit * 3 / 2);
    }

    #[test]
    fn lanterns_guard_the_light() {
        assert!(in_light(64, 64));
        assert!(!in_light(128, 128));
    }

    #[test]
    fn sparks_can_be_scooped() {
        let mut sim = open_lair(&[0u8; 32], false).unwrap();
        sim.phase_step = super::RIME_STEPS + 1; // Well into the Gloaming.
        sim.hits = 9;
        let attack = Intent {
            dx: 0,
            dy: 0,
            attack: true,
            dash: false,
        };
        sim.player.x = 128;
        sim.player.y = 112;
        sim.player.facing = 3;
        let out = step_lair(&mut sim, attack, &[0u8; 32], &stone_weapon(), 20_000).unwrap();
        assert!(out.spilled.is_some());
        assert!(scoopable(&sim, 128, 112).is_some());
        assert_eq!(sim.phase, PHASE_GLOAMING);
        let _ = (PHASE_NOON, PHASE_RIME);
        let _: &LairSim = &sim;
    }
}
