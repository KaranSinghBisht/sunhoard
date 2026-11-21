//! Copies the arena account into the pure fight state and back.

use crate::logic::numbers::MAX_MONSTERS;
use crate::logic::{Fight, Fighter, Foe};
use crate::state::{Arena, Body, Monster};

pub(crate) fn read_fight(arena: &Arena) -> Fight {
    let mut foes = [Foe::empty(); MAX_MONSTERS];
    let count = usize::from(arena.monster_count).min(MAX_MONSTERS);
    for index in 0..count {
        foes[index] = foe_from(&arena.monsters[index]);
    }
    Fight {
        step_index: arena.step_index,
        room_w: arena.room_w,
        room_h: arena.room_h,
        player: fighter_from(&arena.player),
        foes,
        foe_count: count as u8,
    }
}

pub(crate) fn write_fight(arena: &mut Arena, fight: &Fight) {
    arena.step_index = fight.step_index;
    arena.room_w = fight.room_w;
    arena.room_h = fight.room_h;
    arena.player_x = fight.player.x;
    arena.player_y = fight.player.y;
    arena.player_hp = fight.player.hp;
    write_body(&mut arena.player, fight.player);
    let count = usize::from(fight.foe_count).min(MAX_MONSTERS);
    arena.monster_count = count as u8;
    for index in 0..count {
        write_foe(&mut arena.monsters[index], fight.foes[index]);
    }
    for slot in arena.monsters.iter_mut().skip(count) {
        *slot = Monster {
            aim_x: 0,
            aim_y: 0,
            body: Body {
                x: 0,
                y: 0,
                hp: 0,
                facing: 0,
                attack_cd: 0,
                invuln: 0,
                dash_cd: 0,
                dash_left: 0,
                _pad: [0; 3],
            },
            kind: 0,
            aim_age: 0,
            _pad: [0; 2],
        };
    }
}

fn fighter_from(body: &Body) -> Fighter {
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

fn write_body(body: &mut Body, fighter: Fighter) {
    body.x = fighter.x;
    body.y = fighter.y;
    body.hp = fighter.hp;
    body.facing = fighter.facing;
    body.attack_cd = fighter.attack_cd;
    body.invuln = fighter.invuln;
    body.dash_cd = fighter.dash_cd;
    body.dash_left = fighter.dash_left;
}

fn foe_from(monster: &Monster) -> Foe {
    Foe {
        kind: monster.kind,
        body: fighter_from(&monster.body),
        aim_x: monster.aim_x,
        aim_y: monster.aim_y,
        aim_age: monster.aim_age,
    }
}

fn write_foe(monster: &mut Monster, foe: Foe) {
    monster.kind = foe.kind;
    monster.aim_x = foe.aim_x;
    monster.aim_y = foe.aim_y;
    monster.aim_age = foe.aim_age;
    write_body(&mut monster.body, foe.body);
}
