//! Copies the arena account into the lair sim and back.

use crate::logic::lair::LairSim;
use crate::logic::numbers::SHOT_SLOTS;
use crate::logic::Shot;
use crate::state::Arena;

pub(crate) fn read_lair(arena: &Arena) -> LairSim {
    let mut shots = [Shot::empty(); SHOT_SLOTS];
    for index in 0..usize::from(arena.shot_count).min(SHOT_SLOTS) {
        shots[index] = shot_from(&arena.shots[index]);
    }
    let mut sparks = [Shot::empty(); SHOT_SLOTS];
    for index in 0..usize::from(arena.spark_count).min(SHOT_SLOTS) {
        sparks[index] = shot_from(&arena.sparks[index]);
    }
    let mut boss = crate::logic::arena::Monster::empty();
    boss.kind = arena.monsters[0].kind;
    boss.body.x = arena.monsters[0].body.x;
    boss.body.y = arena.monsters[0].body.y;
    boss.body.hp = arena.monsters[0].body.hp;
    LairSim {
        step_index: arena.step_index,
        room_w: arena.room_w,
        room_h: arena.room_h,
        player: body_from(&arena.player),
        boss,
        shots,
        shot_count: usize::from(arena.shot_count).min(SHOT_SLOTS) as u8,
        sparks,
        spark_count: usize::from(arena.spark_count).min(SHOT_SLOTS) as u8,
        phase: arena.boss_phase,
        phase_step: u64::from(arena.boss_timer),
        attack: arena.boss_attack,
        telegraph: arena.boss_telegraph,
        cd: arena.boss_cd,
        hits: arena.lair_hits,
        marked: arena.glare != 0,
        unflushed: arena.unflushed_damage,
        spark_value: arena.spark_value,
        spark_heal: arena.spark_heal,
    }
}

pub(crate) fn write_lair(arena: &mut Arena, sim: &LairSim) {
    arena.step_index = sim.step_index;
    arena.room_w = sim.room_w;
    arena.room_h = sim.room_h;
    arena.player_x = sim.player.x;
    arena.player_y = sim.player.y;
    arena.player_hp = sim.player.hp;
    write_body(&mut arena.player, sim.player);
    arena.monsters[0].kind = sim.boss.kind;
    arena.monsters[0].body.x = sim.boss.body.x;
    arena.monsters[0].body.y = sim.boss.body.y;
    arena.monsters[0].body.hp = sim.boss.body.hp;
    arena.monster_count = 1;
    let shot_count = usize::from(sim.shot_count).min(SHOT_SLOTS);
    arena.shot_count = shot_count as u8;
    for index in 0..shot_count {
        write_shot(&mut arena.shots[index], sim.shots[index]);
    }
    for slot in arena.shots.iter_mut().skip(shot_count) {
        *slot = empty_shot();
    }
    let spark_count = usize::from(sim.spark_count).min(SHOT_SLOTS);
    arena.spark_count = spark_count as u8;
    for index in 0..spark_count {
        write_shot(&mut arena.sparks[index], sim.sparks[index]);
    }
    for slot in arena.sparks.iter_mut().skip(spark_count) {
        *slot = empty_shot();
    }
    arena.boss_phase = sim.phase;
    arena.boss_timer = u16::try_from(sim.phase_step).unwrap_or(u16::MAX);
    arena.boss_attack = sim.attack;
    arena.boss_telegraph = sim.telegraph;
    arena.boss_cd = sim.cd;
    arena.lair_hits = sim.hits;
    arena.unflushed_damage = sim.unflushed;
    arena.spark_value = sim.spark_value;
    arena.spark_heal = sim.spark_heal;
}

fn body_from(body: &crate::state::Body) -> crate::logic::arena::Body {
    crate::logic::arena::Body {
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

fn write_body(body: &mut crate::state::Body, sim: crate::logic::arena::Body) {
    body.x = sim.x;
    body.y = sim.y;
    body.hp = sim.hp;
    body.facing = sim.facing;
    body.attack_cd = sim.attack_cd;
    body.invuln = sim.invuln;
    body.dash_cd = sim.dash_cd;
    body.dash_left = sim.dash_left;
    body.slow = sim.slow;
}

fn shot_from(shot: &crate::state::Shot) -> Shot {
    Shot {
        x: shot.x,
        y: shot.y,
        vx: shot.vx,
        vy: shot.vy,
        life: shot.life,
        kind: shot.kind,
    }
}

fn write_shot(shot: &mut crate::state::Shot, value: Shot) {
    shot.x = value.x;
    shot.y = value.y;
    shot.vx = value.vx;
    shot.vy = value.vy;
    shot.life = value.life;
    shot.kind = value.kind;
}

fn empty_shot() -> crate::state::Shot {
    crate::state::Shot {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        kind: 0,
        _pad: [0; 2],
    }
}
