//! A Bramble Cellars run: six rooms, five to seven monsters each, then the
//! Snuffer. Three layouts, reused, all positions from the room seed.

use super::arena::{
    step_arena, ArenaSim, Body, Intent, Monster, Shot,
};
use super::combat::Weapon;
use super::ids::{MAT_STONE, MONSTER_SNUFFER, RARITY_COMMON};
use super::numbers::{
    MAX_MONSTERS, PLAYER_HP, ROOM_MONSTERS, ROOMS_PER_RUN, ROOM_SIDE, SHOT_SLOTS,
};
use super::roll::expand;
use crate::errors::LogicError;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fighter {
    pub x: i32,
    pub y: i32,
    pub hp: i32,
    pub facing: u8,
    pub attack_cd: u8,
    pub invuln: u8,
    pub dash_cd: u8,
    pub dash_left: u8,
    pub slow: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Foe {
    pub kind: u8,
    pub body: Fighter,
    pub aim_x: i32,
    pub aim_y: i32,
    pub aim_age: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fight {
    pub step_index: u64,
    pub room_w: i32,
    pub room_h: i32,
    pub player: Fighter,
    pub foes: [Foe; MAX_MONSTERS],
    pub foe_count: u8,
    pub shots: [Shot; SHOT_SLOTS],
    pub shot_count: u8,
    pub boss_attack: u8,
    pub boss_telegraph: u8,
    pub boss_cd: u8,
}

pub fn stone_weapon() -> Weapon {
    Weapon {
        material: MAT_STONE,
        rarity: RARITY_COMMON,
        keen_ppm: 0,
        brutal_bp: 0,
    }
}

/// Opens room `room` (1..=6) of a run. The seed is the room's VRF bytes; the
/// player enters with `start_hp`, carried between rooms.
pub fn open_room(seed: &[u8; 32], room: u8, start_hp: i32) -> Result<Fight, LogicError> {
    if room == 0 || room > ROOMS_PER_RUN {
        return Err(LogicError::BadRoom);
    }
    let mut sim = ArenaSim::new(ROOM_SIDE, ROOM_SIDE)?;
    if room == ROOMS_PER_RUN {
        sim.add_monster(MONSTER_SNUFFER, ROOM_SIDE / 2, ROOM_SIDE / 2)?;
    } else {
        place_room(&mut sim, room, seed)?;
    }
    let hp = start_hp.clamp(1, PLAYER_HP);
    sim.player = Body::at(32, 128, hp);
    sim.player_x = 32;
    sim.player_y = 128;
    sim.player_hp = hp;
    Ok(from_sim(&sim))
}

fn place_room(sim: &mut ArenaSim, room: u8, seed: &[u8; 32]) -> Result<(), LogicError> {
    let count = ROOM_MONSTERS[usize::from(room - 1)];
    let layout = room % 3;
    for index in 0..usize::from(count) {
        let roll = expand(seed, u64::from(room) * 8 + index as u64);
        let (x, y) = spot(layout, index, &roll);
        let kind = word(&roll, 0) % 3;
        sim.add_monster(kind as u8, x, y)?;
    }
    Ok(())
}

/// Three layouts, reused across the six rooms.
fn spot(layout: u8, index: usize, roll: &[u8; 32]) -> (i32, i32) {
    match layout {
        // Scattered across the room.
        0 => (
            60 + (word(roll, 1) % 140) as i32,
            40 + (word(roll, 2) % 170) as i32,
        ),
        // A loose cluster.
        1 => {
            let cx = 110 + (word(roll, 1) % 70) as i32;
            let cy = 90 + (word(roll, 2) % 90) as i32;
            let col = (index % 3) as i32 - 1;
            let row = ((index / 3) % 3) as i32 - 1;
            (cx + col * 26, cy + row * 26)
        }
        // A diagonal line.
        _ => (40 + index as i32 * 28, 40 + index as i32 * 24),
    }
}

pub fn step_fight(
    fight: &mut Fight,
    intent: Intent,
    seed: &[u8; 32],
    weapon: &Weapon,
) -> Result<(), LogicError> {
    let mut sim = to_sim(fight)?;
    step_arena(&mut sim, intent, seed, weapon)?;
    *fight = from_sim(&sim);
    Ok(())
}

pub fn room_clear(fight: &Fight) -> bool {
    let count = usize::from(fight.foe_count);
    count > 0 && fight.player.hp > 0 && fight.foes[..count].iter().all(|foe| foe.body.hp <= 0)
}

/// True when the Snuffer is in this room.
pub fn is_boss_room(fight: &Fight) -> bool {
    fight
        .foes
        .iter()
        .take(usize::from(fight.foe_count))
        .any(|foe| foe.kind == MONSTER_SNUFFER)
}

fn to_sim(fight: &Fight) -> Result<ArenaSim, LogicError> {
    let mut sim = ArenaSim::new(fight.room_w, fight.room_h)?;
    sim.step_index = fight.step_index;
    sim.player = body_from(fight.player);
    sim.player_x = fight.player.x;
    sim.player_y = fight.player.y;
    sim.player_hp = fight.player.hp;
    sim.monster_count = fight.foe_count;
    for index in 0..usize::from(fight.foe_count) {
        sim.monsters[index] = monster_from(fight.foes[index]);
    }
    sim.shots = fight.shots;
    sim.shot_count = fight.shot_count;
    sim.boss_attack = fight.boss_attack;
    sim.boss_telegraph = fight.boss_telegraph;
    sim.boss_cd = fight.boss_cd;
    Ok(sim)
}

fn from_sim(sim: &ArenaSim) -> Fight {
    let mut foes = [Foe::empty(); MAX_MONSTERS];
    for index in 0..usize::from(sim.monster_count) {
        foes[index] = foe_from(sim.monsters[index]);
    }
    Fight {
        step_index: sim.step_index,
        room_w: sim.room_w,
        room_h: sim.room_h,
        player: fighter_from(sim.player),
        foes,
        foe_count: sim.monster_count,
        shots: sim.shots,
        shot_count: sim.shot_count,
        boss_attack: sim.boss_attack,
        boss_telegraph: sim.boss_telegraph,
        boss_cd: sim.boss_cd,
    }
}

fn body_from(fighter: Fighter) -> Body {
    Body {
        x: fighter.x,
        y: fighter.y,
        hp: fighter.hp,
        facing: fighter.facing,
        attack_cd: fighter.attack_cd,
        invuln: fighter.invuln,
        dash_cd: fighter.dash_cd,
        dash_left: fighter.dash_left,
        slow: fighter.slow,
    }
}

fn fighter_from(body: Body) -> Fighter {
    Fighter {
        x: body.x,
        y: body.y,
        hp: body.hp,
        facing: body.facing,
        attack_cd: body.attack_cd,
        invuln: body.invuln,
        dash_cd: body.dash_cd,
        dash_left: body.dash_left,
        slow: body.slow,
    }
}

fn monster_from(foe: Foe) -> Monster {
    Monster {
        kind: foe.kind,
        body: body_from(foe.body),
        aim_x: foe.aim_x,
        aim_y: foe.aim_y,
        aim_age: foe.aim_age,
    }
}

fn foe_from(monster: Monster) -> Foe {
    Foe {
        kind: monster.kind,
        body: fighter_from(monster.body),
        aim_x: monster.aim_x,
        aim_y: monster.aim_y,
        aim_age: monster.aim_age,
    }
}

fn word(bytes: &[u8; 32], index: usize) -> u32 {
    let start = index * 4;
    if start + 4 > bytes.len() {
        return 0;
    }
    u32::from_le_bytes([bytes[start], bytes[start + 1], bytes[start + 2], bytes[start + 3]])
}

impl Foe {
    pub const fn empty() -> Self {
        Self {
            kind: 0,
            body: Fighter {
                x: 0,
                y: 0,
                hp: 0,
                facing: 0,
                attack_cd: 0,
                invuln: 0,
                dash_cd: 0,
                dash_left: 0,
                slow: 0,
            },
            aim_x: 0,
            aim_y: 0,
            aim_age: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{is_boss_room, open_room, room_clear, step_fight, stone_weapon};
    use crate::logic::arena::Intent;
    use crate::logic::numbers::ROOMS_PER_RUN;

    #[test]
    fn rooms_one_to_five_hold_monsters_and_room_six_holds_the_snuffer() {
        for room in 1..=ROOMS_PER_RUN {
            let fight = open_room(&[room; 32], room, 100).unwrap();
            assert!(fight.foe_count > 0);
            assert!(!room_clear(&fight));
            assert_eq!(is_boss_room(&fight), room == ROOMS_PER_RUN);
        }
    }

    #[test]
    fn a_step_moves_and_hp_carries_between_rooms() {
        let mut fight = open_room(&[0u8; 32], 1, 63).unwrap();
        assert_eq!(fight.player.hp, 63);
        let before = fight.player.x;
        step_fight(
            &mut fight,
            Intent {
                dx: 1,
                dy: 0,
                attack: false,
                dash: false,
            },
            &[0u8; 32],
            &stone_weapon(),
        )
        .unwrap();
        assert_eq!(fight.player.x, before + 8);
        assert_eq!(fight.step_index, 1);
    }

    #[test]
    fn a_bad_room_is_rejected() {
        assert!(open_room(&[0u8; 32], 0, 100).is_err());
        assert!(open_room(&[0u8; 32], 7, 100).is_err());
    }

    #[test]
    fn the_snuffer_fight_can_end() {
        let mut fight = open_room(&[5u8; 32], ROOMS_PER_RUN, 100).unwrap();
        let mut intent = Intent {
            dx: 1,
            dy: 0,
            attack: true,
            dash: false,
        };
        let mut steps = 0;
        while !room_clear(&fight) && steps < 5_000 {
            if fight.player.hp <= 0 {
                break;
            }
            let boss = &fight.foes[0];
            if fight.player.x < boss.body.x {
                intent.dx = 1;
            } else if fight.player.x > boss.body.x {
                intent.dx = -1;
            } else {
                intent.dx = 0;
            }
            if fight.player.y < boss.body.y {
                intent.dy = 1;
            } else if fight.player.y > boss.body.y {
                intent.dy = -1;
            } else {
                intent.dy = 0;
            }
            intent.attack = (fight.player.x - boss.body.x).abs() <= 24
                && (fight.player.y - boss.body.y).abs() <= 24;
            intent.dash = !intent.attack;
            step_fight(&mut fight, intent, &[5u8; 32], &stone_weapon()).unwrap();
            steps += 1;
        }
        // The dumb chase can die or win; either way the sim must not loop forever.
        assert!(steps < 5_000);
    }
}
