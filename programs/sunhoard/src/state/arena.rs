//! One player's dungeon or lair. The step function reads this into `logic::ArenaSim`.

use anchor_lang::prelude::*;

use super::bits::SHOT_SLOTS;
use crate::logic::numbers::MAX_MONSTERS;

#[zero_copy]
pub struct Body {
    pub x: i32,
    pub y: i32,
    pub hp: i32,
    pub facing: u8,
    pub attack_cd: u8,
    pub invuln: u8,
    pub dash_cd: u8,
    pub dash_left: u8,
    pub _pad: [u8; 3],
}

#[zero_copy]
pub struct Monster {
    pub aim_x: i32,
    pub aim_y: i32,
    pub body: Body,
    pub kind: u8,
    pub aim_age: u8,
    pub _pad: [u8; 2],
}

#[zero_copy]
pub struct Shot {
    pub x: i32,
    pub y: i32,
    pub vx: i16,
    pub vy: i16,
    pub life: u8,
    pub kind: u8,
    pub _pad: [u8; 2],
}

#[account(zero_copy)]
pub struct Arena {
    pub owner: Pubkey,
    pub seed: [u8; 32],
    pub step_index: u64,
    pub last_slot: u64,
    pub task_id: i64,
    pub unflushed_damage: u64,
    pub room_w: i32,
    pub room_h: i32,
    pub player_x: i32,
    pub player_y: i32,
    pub player_hp: i32,
    pub glare: i32,
    pub boss_timer: u16,
    pub mode: u8,
    pub room: u8,
    pub monster_count: u8,
    pub shot_count: u8,
    pub spark_count: u8,
    pub boss_phase: u8,
    pub player: Body,
    pub _pad_player: [u8; 4],
    pub monsters: [Monster; MAX_MONSTERS],
    pub shots: [Shot; SHOT_SLOTS],
    pub sparks: [Shot; SHOT_SLOTS],
    pub run_nonce: u64,
    pub intent_dx: i8,
    pub intent_dy: i8,
    pub intent_attack: u8,
    pub intent_dash: u8,
    pub _pad_end: [u8; 4],
}

impl Arena {
    pub const LEN: usize = core::mem::size_of::<Arena>();
}
