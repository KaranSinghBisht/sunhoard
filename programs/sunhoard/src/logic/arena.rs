use crate::errors::LogicError;

use super::combat::{attack_damage, Weapon};
use super::math::isqrt;
use super::numbers::{
    ATTACK_STEPS, BOSS_ATTACK_GAP_STEPS, BOSS_EMBER_DMG, BOSS_EMBER_LIFE, BOSS_EMBER_SPEED,
    BOSS_FROST_STEPS, BOSS_SNUFF_DMG, BOSS_SNUFF_RANGE, BOSS_TELEGRAPH_STEPS, BOSS_WICK_DMG,
    BOSS_WICK_LIFE, CONTACT_UNITS, DASH_COOLDOWN_STEPS, DASH_SPEED, DASH_STEPS,
    DIAGONAL_DEN, DIAGONAL_NUM, INVULN_STEPS, MAX_MONSTERS, MONSTER_AGGRO, MONSTER_DMG,
    MONSTER_HP, MONSTER_REAIM, MONSTER_SPEED, PLAYER_HP, PLAYER_SPEED, REACH_UNITS,
    SHOT_HIT_UNITS, SHOT_SLOTS, SLOWED_SPEED,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Intent {
    pub dx: i8,
    pub dy: i8,
    pub attack: bool,
    pub dash: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Body {
    pub x: i32,
    pub y: i32,
    pub hp: i32,
    pub facing: u8,
    pub attack_cd: u8,
    pub invuln: u8,
    pub dash_cd: u8,
    pub dash_left: u8,
    /// Steps of Snuff frost left: −40% speed.
    pub slow: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Monster {
    pub kind: u8,
    pub body: Body,
    pub aim_x: i32,
    pub aim_y: i32,
    pub aim_age: u8,
}

pub const SHOT_EMBER: u8 = 1;
pub const SHOT_WICK: u8 = 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Shot {
    pub x: i32,
    pub y: i32,
    pub vx: i16,
    pub vy: i16,
    pub life: u8,
    pub kind: u8,
}

impl Shot {
    pub const fn empty() -> Self {
        Self {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            life: 0,
            kind: 0,
        }
    }
}

/// The Snuffer's attack pattern: 0 none, 1 ember volley, 2 wick lines, 3 snuff.
pub const BOSS_IDLE: u8 = 0;
pub const BOSS_EMBER: u8 = 1;
pub const BOSS_WICK: u8 = 2;
pub const BOSS_SNUFF: u8 = 3;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ArenaSim {
    pub step_index: u64,
    pub player_x: i32,
    pub player_y: i32,
    pub player_hp: i32,
    pub(crate) monster_count: u8,
    pub(crate) monsters: [Monster; MAX_MONSTERS],
    pub shots: [Shot; SHOT_SLOTS],
    pub shot_count: u8,
    pub boss_attack: u8,
    pub boss_telegraph: u8,
    pub boss_cd: u8,
    pub(crate) room_w: i32,
    pub(crate) room_h: i32,
    pub(crate) player: Body,
}

pub fn step_arena(
    sim: &mut ArenaSim,
    intent: Intent,
    seed: &[u8; 32],
    weapon: &Weapon,
) -> Result<(), LogicError> {
    check_intent(&intent)?;
    attack_damage(weapon, seed, 0, 0)?;
    if sim.player.hp <= 0 {
        return advance(sim);
    }
    tick_all(sim);
    begin_dash(&mut sim.player, &intent);
    let speed = if sim.player.dash_left > 0 {
        DASH_SPEED
    } else if sim.player.slow > 0 {
        SLOWED_SPEED
    } else {
        PLAYER_SPEED
    };
    move_cardinal(
        &mut sim.player,
        intent.dx,
        intent.dy,
        speed,
        sim.room_w,
        sim.room_h,
    )?;
    step_boss(sim, seed)?;
    steer_monsters(sim)?;
    swing(sim, &intent, seed, weapon)?;
    step_shots(sim)?;
    contact(sim)?;
    publish(sim);
    advance(sim)
}

impl ArenaSim {
    pub fn new(room_w: i32, room_h: i32) -> Result<Self, LogicError> {
        if !(1..=4_096).contains(&room_w) || !(1..=4_096).contains(&room_h) {
            return Err(LogicError::BadRoom);
        }
        let player = Body::at(0, 0, PLAYER_HP);
        Ok(Self {
            step_index: 0,
            player_x: 0,
            player_y: 0,
            player_hp: PLAYER_HP,
            monster_count: 0,
            monsters: [Monster::empty(); MAX_MONSTERS],
            shots: [Shot::empty(); SHOT_SLOTS],
            shot_count: 0,
            boss_attack: BOSS_IDLE,
            boss_telegraph: 0,
            // The first attack telegraphs on the first step; later ones wait.
            boss_cd: 0,
            room_w,
            room_h,
            player,
        })
    }

    pub fn add_monster(&mut self, kind: u8, x: i32, y: i32) -> Result<(), LogicError> {
        let hp = if kind == super::ids::MONSTER_SNUFFER {
            super::numbers::SNUFFER_HP
        } else {
            monster_stat(MONSTER_HP, kind)?
        };
        let index = usize::from(self.monster_count);
        if index >= MAX_MONSTERS {
            return Err(LogicError::Full);
        }
        if x < 0 || y < 0 || x > self.room_w || y > self.room_h {
            return Err(LogicError::BadRoom);
        }
        let reaim = if kind == super::ids::MONSTER_SNUFFER {
            1
        } else {
            monster_reaim(kind)?
        };
        self.monsters[index] = Monster {
            kind,
            body: Body::at(x, y, hp),
            aim_x: x,
            aim_y: y,
            aim_age: reaim.saturating_sub(1),
        };
        self.monster_count += 1;
        Ok(())
    }

    pub fn monster_hp(&self, index: usize) -> Option<i32> {
        self.monsters.get(index).map(|monster| monster.body.hp)
    }

    pub fn monster_pos(&self, index: usize) -> Option<(i32, i32)> {
        self.monsters
            .get(index)
            .map(|monster| (monster.body.x, monster.body.y))
    }

    fn boss(&mut self) -> Option<&mut Monster> {
        self.monsters
            .iter_mut()
            .take(usize::from(self.monster_count))
            .find(|monster| monster.kind == super::ids::MONSTER_SNUFFER && monster.body.hp > 0)
    }
}

fn check_intent(intent: &Intent) -> Result<(), LogicError> {
    if !(-1..=1).contains(&intent.dx) || !(-1..=1).contains(&intent.dy) {
        return Err(LogicError::BadIntent);
    }
    Ok(())
}

fn tick_all(sim: &mut ArenaSim) {
    tick_body(&mut sim.player);
    for index in 0..usize::from(sim.monster_count) {
        tick_body(&mut sim.monsters[index].body);
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
    body.dash_left = DASH_STEPS;
    body.dash_cd = DASH_COOLDOWN_STEPS;
    if body.invuln < DASH_STEPS {
        body.invuln = DASH_STEPS;
    }
}

fn steer_monsters(sim: &mut ArenaSim) -> Result<(), LogicError> {
    let (px, py) = (sim.player.x, sim.player.y);
    for index in 0..usize::from(sim.monster_count) {
        let monster = &mut sim.monsters[index];
        if monster.kind == super::ids::MONSTER_SNUFFER {
            continue;
        }
        steer(monster, px, py, sim.room_w, sim.room_h)?;
    }
    Ok(())
}

fn steer(
    monster: &mut Monster,
    px: i32,
    py: i32,
    room_w: i32,
    room_h: i32,
) -> Result<(), LogicError> {
    if monster.body.hp <= 0 {
        return Ok(());
    }
    let aggro = monster_stat(MONSTER_AGGRO, monster.kind)?;
    if dist2(monster.body.x, monster.body.y, px, py) > i64::from(aggro) * i64::from(aggro) {
        return Ok(());
    }
    let reaim = monster_reaim(monster.kind)?;
    monster.aim_age = monster.aim_age.saturating_add(1);
    if monster.aim_age >= reaim {
        monster.aim_x = px;
        monster.aim_y = py;
        monster.aim_age = 0;
    }
    let speed = monster_stat(MONSTER_SPEED, monster.kind)?;
    move_toward(
        &mut monster.body,
        monster.aim_x,
        monster.aim_y,
        speed,
        room_w,
        room_h,
    )
}

/// The Snuffer: telegraphs, then fires one of three attacks, then waits.
fn step_boss(sim: &mut ArenaSim, seed: &[u8; 32]) -> Result<(), LogicError> {
    if sim.boss().is_none() {
        return Ok(());
    }
    if sim.boss_telegraph > 0 {
        sim.boss_telegraph -= 1;
        if sim.boss_telegraph == 0 {
            fire_boss(sim)?;
        }
        return Ok(());
    }
    if sim.boss_cd > 0 {
        sim.boss_cd -= 1;
    }
    // Lumber toward the Keeper while waiting.
    let (px, py) = (sim.player.x, sim.player.y);
    let (room_w, room_h) = (sim.room_w, sim.room_h);
    let (bx, by) = {
        let boss = sim.boss().ok_or(LogicError::BadIntent)?;
        (boss.body.x, boss.body.y)
    };
    if dist2(bx, by, px, py) > 40 * 40 {
        let boss = sim.boss().ok_or(LogicError::BadIntent)?;
        move_toward(
            &mut boss.body,
            px,
            py,
            super::numbers::SNUFFER_SPEED,
            room_w,
            room_h,
        )?;
    }
    if sim.boss_cd == 0 {
        let pattern = word0(&super::roll::expand(seed, sim.step_index)) % 3;
        sim.boss_attack = (pattern + 1) as u8;
        sim.boss_telegraph = BOSS_TELEGRAPH_STEPS;
        sim.boss_cd = BOSS_ATTACK_GAP_STEPS;
    }
    Ok(())
}

fn fire_boss(sim: &mut ArenaSim) -> Result<(), LogicError> {
    let (px, py) = (sim.player.x, sim.player.y);
    let (bx, by) = {
        let boss = sim.boss().ok_or(LogicError::BadIntent)?;
        (boss.body.x, boss.body.y)
    };
    match sim.boss_attack {
        BOSS_EMBER => {
            let (dx, dy) = aim(px, py, bx, by, BOSS_EMBER_SPEED);
            add_shot(sim, bx, by, dx, dy, BOSS_EMBER_LIFE, SHOT_EMBER)?;
            let (dx2, dy2) = aim(
                px.saturating_sub(24),
                py.saturating_add(24),
                bx,
                by,
                BOSS_EMBER_SPEED,
            );
            add_shot(sim, bx, by, dx2, dy2, BOSS_EMBER_LIFE, SHOT_EMBER)?;
            let (dx3, dy3) = aim(
                px.saturating_add(24),
                py.saturating_sub(24),
                bx,
                by,
                BOSS_EMBER_SPEED,
            );
            add_shot(sim, bx, by, dx3, dy3, BOSS_EMBER_LIFE, SHOT_EMBER)
        }
        BOSS_WICK => {
            add_shot(sim, 0, 0, 3, 3, BOSS_WICK_LIFE, SHOT_WICK)?;
            add_shot(sim, sim.room_w, 0, -3, 3, BOSS_WICK_LIFE, SHOT_WICK)
        }
        BOSS_SNUFF => {
            let x = (px - 20).clamp(0, sim.room_w);
            let y = (py - 20).clamp(0, sim.room_h);
            let boss = sim.boss().ok_or(LogicError::BadIntent)?;
            boss.body.x = x;
            boss.body.y = y;
            if dist2(x, y, px, py) <= i64::from(BOSS_SNUFF_RANGE) * i64::from(BOSS_SNUFF_RANGE) {
                sim.player.hp = sim.player.hp.saturating_sub(BOSS_SNUFF_DMG);
                sim.player.slow = BOSS_FROST_STEPS;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

/// A velocity toward the target at the given speed, integers only.
fn aim(tx: i32, ty: i32, fx: i32, fy: i32, speed: i32) -> (i16, i16) {
    let dx = i64::from(tx) - i64::from(fx);
    let dy = i64::from(ty) - i64::from(fy);
    let dist = isqrt(dx * dx + dy * dy);
    if dist == 0 {
        return (0, 0);
    }
    let vx = i16::try_from((dx * i64::from(speed)) / dist).unwrap_or(0);
    let vy = i16::try_from((dy * i64::from(speed)) / dist).unwrap_or(0);
    (vx, vy)
}

fn add_shot(
    sim: &mut ArenaSim,
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

fn step_shots(sim: &mut ArenaSim) -> Result<(), LogicError> {
    let reach = i64::from(SHOT_HIT_UNITS) * i64::from(SHOT_HIT_UNITS);
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
        let outside = next.x < 0
            || next.y < 0
            || next.x > sim.room_w
            || next.y > sim.room_h
            || next.life == 0;
        if outside {
            continue;
        }
        if dist2(sim.player.x, sim.player.y, next.x, next.y) <= reach {
            let dmg = match next.kind {
                SHOT_EMBER => BOSS_EMBER_DMG,
                _ => BOSS_WICK_DMG,
            };
            sim.player.hp = sim.player.hp.saturating_sub(dmg);
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

fn swing(
    sim: &mut ArenaSim,
    intent: &Intent,
    seed: &[u8; 32],
    weapon: &Weapon,
) -> Result<(), LogicError> {
    if !intent.attack || sim.player.attack_cd > 0 {
        return Ok(());
    }
    sim.player.attack_cd = ATTACK_STEPS;
    let mut hit = 0u16;
    for index in 0..usize::from(sim.monster_count) {
        let monster = &mut sim.monsters[index];
        if monster.body.hp <= 0 {
            continue;
        }
        if !in_arc(
            sim.player.x,
            sim.player.y,
            sim.player.facing,
            monster.body.x,
            monster.body.y,
        ) {
            continue;
        }
        let dealt = attack_damage(weapon, seed, sim.step_index, hit)?;
        monster.body.hp = monster.body.hp.saturating_sub(dealt);
        hit = hit.saturating_add(1);
    }
    Ok(())
}

fn contact(sim: &mut ArenaSim) -> Result<(), LogicError> {
    if sim.player.invuln > 0 {
        return Ok(());
    }
    let reach = i64::from(CONTACT_UNITS) * i64::from(CONTACT_UNITS);
    for index in 0..usize::from(sim.monster_count) {
        let monster = &sim.monsters[index];
        if monster.body.hp <= 0 || monster.kind == super::ids::MONSTER_SNUFFER {
            continue;
        }
        if dist2(sim.player.x, sim.player.y, monster.body.x, monster.body.y) > reach {
            continue;
        }
        let dmg = monster_stat(MONSTER_DMG, monster.kind)?;
        sim.player.hp = sim.player.hp.saturating_sub(dmg);
        sim.player.invuln = INVULN_STEPS;
        return Ok(());
    }
    Ok(())
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
    body.x = place(body.x, sx, room_w)?;
    body.y = place(body.y, sy, room_h)?;
    Ok(())
}

fn move_toward(
    body: &mut Body,
    tx: i32,
    ty: i32,
    speed: i32,
    room_w: i32,
    room_h: i32,
) -> Result<(), LogicError> {
    let dx = i64::from(tx) - i64::from(body.x);
    let dy = i64::from(ty) - i64::from(body.y);
    let dist = isqrt(dx * dx + dy * dy);
    if dist == 0 {
        return Ok(());
    }
    let step = i64::from(speed).min(dist);
    let sx = i32::try_from(dx * step / dist).map_err(|_| LogicError::Overflow)?;
    let sy = i32::try_from(dy * step / dist).map_err(|_| LogicError::Overflow)?;
    body.facing = facing_from(sx, sy, body.facing);
    body.x = place(body.x, sx, room_w)?;
    body.y = place(body.y, sy, room_h)?;
    Ok(())
}

fn axis_step(dx: i32, dy: i32, speed: i32) -> (i32, i32) {
    if dx == 0 && dy == 0 {
        return (0, 0);
    }
    let magnitude = if dx != 0 && dy != 0 {
        speed * DIAGONAL_NUM / DIAGONAL_DEN
    } else {
        speed
    };
    (dx.signum() * magnitude, dy.signum() * magnitude)
}

fn place(value: i32, delta: i32, hi: i32) -> Result<i32, LogicError> {
    let sum = value.checked_add(delta).ok_or(LogicError::Overflow)?;
    Ok(sum.clamp(0, hi))
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

fn facing_vec(facing: u8) -> (i32, i32) {
    match facing {
        0 => (1, 0),
        1 => (0, 1),
        2 => (-1, 0),
        _ => (0, -1),
    }
}

fn in_arc(px: i32, py: i32, facing: u8, tx: i32, ty: i32) -> bool {
    let dx = i64::from(tx) - i64::from(px);
    let dy = i64::from(ty) - i64::from(py);
    let dist2 = dx * dx + dy * dy;
    let reach = i64::from(REACH_UNITS) * i64::from(REACH_UNITS);
    if dist2 == 0 {
        return true;
    }
    if dist2 > reach {
        return false;
    }
    let (fx, fy) = facing_vec(facing);
    let dot = dx * i64::from(fx) + dy * i64::from(fy);
    dot > 0 && dot * dot * 2 >= dist2
}

fn dist2(ax: i32, ay: i32, bx: i32, by: i32) -> i64 {
    let dx = i64::from(ax) - i64::from(bx);
    let dy = i64::from(ay) - i64::from(by);
    dx * dx + dy * dy
}

fn monster_stat(table: [i32; 3], kind: u8) -> Result<i32, LogicError> {
    table
        .get(usize::from(kind))
        .copied()
        .ok_or(LogicError::BadIntent)
}

fn monster_reaim(kind: u8) -> Result<u8, LogicError> {
    MONSTER_REAIM
        .get(usize::from(kind))
        .copied()
        .ok_or(LogicError::BadIntent)
}

fn publish(sim: &mut ArenaSim) {
    sim.player_x = sim.player.x;
    sim.player_y = sim.player.y;
    sim.player_hp = sim.player.hp;
}

fn advance(sim: &mut ArenaSim) -> Result<(), LogicError> {
    sim.step_index = sim.step_index.checked_add(1).ok_or(LogicError::Overflow)?;
    Ok(())
}

fn word0(bytes: &[u8; 32]) -> u32 {
    u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
}

impl Body {
    pub(crate) const fn at(x: i32, y: i32, hp: i32) -> Self {
        Self {
            x,
            y,
            hp,
            facing: 0,
            attack_cd: 0,
            invuln: 0,
            dash_cd: 0,
            dash_left: 0,
            slow: 0,
        }
    }
}

impl Monster {
    pub(crate) const fn empty() -> Self {
        Self {
            kind: 255,
            body: Body::at(0, 0, 0),
            aim_x: 0,
            aim_y: 0,
            aim_age: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{step_arena, ArenaSim, Intent, Shot, BOSS_EMBER};
    use crate::errors::LogicError;
    use crate::logic::combat::{attack_damage, Weapon};
    use crate::logic::ids::{
        MAT_IRON, MONSTER_RAT, MONSTER_SLIME, MONSTER_SNUFFER, RARITY_COMMON,
    };

    fn still() -> Intent {
        Intent {
            dx: 0,
            dy: 0,
            attack: false,
            dash: false,
        }
    }

    fn weapon() -> Weapon {
        Weapon {
            material: MAT_IRON,
            rarity: RARITY_COMMON,
            keen_ppm: 0,
            brutal_bp: 0,
        }
    }

    fn push(sim: &mut ArenaSim, dx: i8, dy: i8, dash: bool) {
        let seed = [0u8; 32];
        let intent = Intent {
            dx,
            dy,
            attack: false,
            dash,
        };
        step_arena(sim, intent, &seed, &weapon()).unwrap();
    }

    fn quiet_seed() -> [u8; 32] {
        let weapon = weapon();
        let mut seed = [0u8; 32];
        for n in 0..80u8 {
            seed[0] = n;
            if attack_damage(&weapon, &seed, 0, 0).unwrap() == 10 {
                return seed;
            }
        }
        seed
    }

    #[test]
    fn walking_moves_eight_units_and_a_diagonal_moves_both_axes() {
        let mut sim = ArenaSim::new(256, 256).unwrap();
        push(&mut sim, 1, 0, false);
        assert_eq!(sim.player_x, 8);
        push(&mut sim, 1, 1, false);
        assert!(sim.player_x > 8 && sim.player_y > 0);
    }

    #[test]
    fn movement_stops_at_the_room_edge() {
        let mut boxed = ArenaSim::new(10, 10).unwrap();
        boxed.player.x = 8;
        boxed.player_x = 8;
        push(&mut boxed, 1, 0, false);
        assert_eq!(boxed.player_x, 10);
    }

    #[test]
    fn a_dash_covers_twenty_four_units_and_slow_cuts_walking() {
        let mut dasher = ArenaSim::new(256, 256).unwrap();
        push(&mut dasher, 1, 0, true);
        assert_eq!(dasher.player_x, 24);

        let mut frosty = ArenaSim::new(256, 256).unwrap();
        frosty.player.slow = 2;
        push(&mut frosty, 1, 0, false);
        assert_eq!(frosty.player_x, 5);
        // The second step ticks the frost away, so it walks at full speed.
        push(&mut frosty, 1, 0, false);
        assert_eq!(frosty.player_x, 13);
        push(&mut frosty, 1, 0, false);
        assert_eq!(frosty.player_x, 21);
    }

    #[test]
    fn a_rat_chases_inside_aggro_and_stands_outside_it() {
        let seed = [0u8; 32];
        let mut far = ArenaSim::new(256, 256).unwrap();
        far.add_monster(MONSTER_RAT, 200, 0).unwrap();
        step_arena(&mut far, still(), &seed, &weapon()).unwrap();
        assert_eq!(far.monster_pos(0), Some((200, 0)));

        let mut near = ArenaSim::new(256, 256).unwrap();
        near.add_monster(MONSTER_RAT, 30, 0).unwrap();
        step_arena(&mut near, still(), &seed, &weapon()).unwrap();
        assert_eq!(near.monster_pos(0), Some((24, 0)));
    }

    #[test]
    fn an_iron_swing_hits_once_per_cooldown() {
        let seed = quiet_seed();
        let mut sim = ArenaSim::new(256, 256).unwrap();
        sim.add_monster(MONSTER_RAT, 16, 0).unwrap();
        let attack = Intent {
            dx: 0,
            dy: 0,
            attack: true,
            dash: false,
        };
        step_arena(&mut sim, attack, &seed, &weapon()).unwrap();
        assert_eq!(sim.monster_hp(0), Some(8));
        step_arena(&mut sim, attack, &seed, &weapon()).unwrap();
        assert_eq!(sim.monster_hp(0), Some(8));
    }

    #[test]
    fn contact_damage_respects_invulnerability() {
        let seed = [0u8; 32];
        let mut sim = ArenaSim::new(64, 64).unwrap();
        sim.add_monster(MONSTER_RAT, 0, 0).unwrap();
        step_arena(&mut sim, still(), &seed, &weapon()).unwrap();
        assert_eq!(sim.player_hp, 95);
        step_arena(&mut sim, still(), &seed, &weapon()).unwrap();
        assert_eq!(sim.player_hp, 95);
    }

    #[test]
    fn a_shot_moves_and_hits() {
        let mut sim = ArenaSim::new(256, 256).unwrap();
        sim.shots[0] = Shot {
            x: 40,
            y: 0,
            vx: -2,
            vy: 0,
            life: 60,
            kind: BOSS_EMBER,
        };
        sim.shot_count = 1;
        let seed = [0u8; 32];
        step_arena(&mut sim, still(), &seed, &weapon()).unwrap();
        assert_eq!(sim.shots[0].x, 38);
        assert_eq!(sim.player_hp, 100);
        sim.player.x = 38;
        step_arena(&mut sim, still(), &seed, &weapon()).unwrap();
        assert_eq!(sim.player_hp, 90);
        assert_eq!(sim.shots[0].life, 0);
    }

    #[test]
    fn the_snuffer_telegraphs_then_fires() {
        let mut sim = ArenaSim::new(256, 256).unwrap();
        sim.add_monster(MONSTER_SNUFFER, 128, 128).unwrap();
        let seed = [3u8; 32];
        for _ in 0..7 {
            step_arena(&mut sim, still(), &seed, &weapon()).unwrap();
        }
        // Six steps of telegraph, then the attack lands on the seventh step.
        assert_eq!(sim.boss_telegraph, 0);
        assert!(
            sim.shot_count > 0 || sim.player_hp < 100,
            "an attack went off"
        );
    }

    #[test]
    fn bad_input_and_a_downed_keeper() {
        let seed = [0u8; 32];
        let mut sim = ArenaSim::new(32, 32).unwrap();
        let bad = Intent {
            dx: 2,
            dy: 0,
            attack: false,
            dash: false,
        };
        assert_eq!(
            step_arena(&mut sim, bad, &seed, &weapon()),
            Err(LogicError::BadIntent)
        );
        sim.player.hp = 0;
        sim.player_hp = 0;
        step_arena(
            &mut sim,
            Intent {
                dx: 1,
                dy: 0,
                attack: false,
                dash: false,
            },
            &seed,
            &weapon(),
        )
        .unwrap();
        assert_eq!(sim.player_x, 0);
        assert_eq!(sim.step_index, 1);
        assert!(sim.add_monster(MONSTER_SLIME, 1, 1).is_ok());
        assert!(ArenaSim::new(0, 10).is_err());
    }
}
