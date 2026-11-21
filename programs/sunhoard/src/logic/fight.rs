//! The first room. Three foes, one stone weapon's worth of steps, positions from the room seed.

use super::arena::{step_arena, ArenaSim, Body, Intent, Monster};
use super::combat::Weapon;
use super::ids::{MAT_STONE, RARITY_COMMON};
use super::numbers::{MAX_MONSTERS, PLAYER_HP, ROOM_SIDE};
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
}

pub fn stone_weapon() -> Weapon {
    Weapon {
        material: MAT_STONE,
        rarity: RARITY_COMMON,
        keen_ppm: 0,
        brutal_bp: 0,
    }
}

pub fn open_room(seed: &[u8; 32]) -> Result<Fight, LogicError> {
    let mut sim = ArenaSim::new(ROOM_SIDE, ROOM_SIDE)?;
    sim.player = Body::at(32, 128, PLAYER_HP);
    sim.player_x = 32;
    sim.player_y = 128;
    sim.player_hp = PLAYER_HP;
    place_three(&mut sim, seed)?;
    Ok(from_sim(&sim))
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

fn place_three(sim: &mut ArenaSim, seed: &[u8; 32]) -> Result<(), LogicError> {
    for kind in 0..3u8 {
        let x = 80 + i32::from(seed[usize::from(kind)]) % 140;
        let y = 40 + i32::from(seed[8 + usize::from(kind)]) % 160;
        sim.add_monster(kind, x, y)?;
    }
    Ok(())
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
            },
            aim_x: 0,
            aim_y: 0,
            aim_age: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{open_room, room_clear, step_fight, stone_weapon};
    use crate::logic::arena::Intent;

    #[test]
    fn the_first_room_has_three_foes_and_a_step_moves() {
        let mut fight = open_room(&[0u8; 32]).unwrap();
        assert_eq!(fight.foe_count, 3);
        assert!(!room_clear(&fight));
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
}
