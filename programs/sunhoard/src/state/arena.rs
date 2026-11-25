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
    /// Steps of Snuff frost left: −40% speed.
    pub slow: u8,
    pub _pad: [u8; 2],
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
    /// The weapon the run uses: material, rarity and the two combat traits.
    pub weapon_keen: u16,
    pub weapon_brutal: u16,
    pub mode: u8,
    pub room: u8,
    pub monster_count: u8,
    pub shot_count: u8,
    pub spark_count: u8,
    pub boss_phase: u8,
    /// The Snuffer's current attack pattern: 0 idle, 1 ember, 2 wick, 3 snuff.
    pub boss_attack: u8,
    /// Telegraph steps left before the attack lands.
    pub boss_telegraph: u8,
    /// Steps until the Snuffer picks its next attack.
    pub boss_cd: u8,
    pub weapon_material: u8,
    pub weapon_rarity: u8,
    /// HP carried between rooms; the lantern restores 30% of what is missing.
    pub carry_hp: u8,
    /// 1 when the current room is cleared and `next_room` may run.
    pub cleared: u8,
    /// 1 while a chest roll is still on its way.
    pub chest_pending: u8,
    /// 1 when this arena is running a lair visit, not a dungeon.
    pub lair: u8,
    pub _pad_mid: [u8; 3],
    pub player: Body,
    pub _pad_player: [u8; 4],
    pub monsters: [Monster; MAX_MONSTERS],
    pub shots: [Shot; SHOT_SLOTS],
    pub sparks: [Shot; SHOT_SLOTS],
    pub run_nonce: u64,
    /// Nonce of the chest VRF request, so a stale callback cannot land twice.
    pub chest_nonce: u64,
    pub intent_dx: i8,
    pub intent_dy: i8,
    pub intent_attack: u8,
    pub intent_dash: u8,
    /// Hits since the last spark in the Gloaming.
    pub lair_hits: u8,
    pub _pad_lair: [u8; 3],
    /// The spark's Sunhoard share, and the heal if it drifts back.
    pub spark_value: u32,
    pub spark_heal: u32,
}

impl Arena {
    pub const LEN: usize = core::mem::size_of::<Arena>();
}
