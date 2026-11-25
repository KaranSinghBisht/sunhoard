//! One 100 ms step. Anyone may call it. Fewer than 8 slots since the last step does nothing.

use anchor_lang::prelude::*;

use super::fight_io::{read_fight, write_fight};
use crate::errors::{GameError, LogicError};
use crate::logic::arena::Intent;
use crate::logic::numbers::TICK_MIN_SLOTS;
use crate::logic::{room_clear, step_fight, Weapon};
use crate::state::{Arena, ARENA_SEED, MODE_FIGHT};

pub fn handle(ctx: Context<TickArena>) -> Result<()> {
    let slot = Clock::get()?.slot;
    let arena = &mut ctx.accounts.arena.load_mut()?;
    if arena.mode != MODE_FIGHT {
        return Ok(());
    }
    if arena.last_slot != 0 && slot < arena.last_slot.saturating_add(TICK_MIN_SLOTS) {
        return Ok(());
    }
    let intent = Intent {
        dx: arena.intent_dx,
        dy: arena.intent_dy,
        attack: arena.intent_attack == 1,
        dash: arena.intent_dash == 1,
    };
    let seed = arena.seed;
    let weapon = Weapon {
        material: arena.weapon_material,
        rarity: arena.weapon_rarity,
        keen_ppm: u32::from(arena.weapon_keen),
        brutal_bp: u32::from(arena.weapon_brutal),
    };
    let mut fight = read_fight(arena);
    step_fight(&mut fight, intent, &seed, &weapon).map_err(rule)?;
    if room_clear(&fight) && arena.cleared == 0 {
        arena.cleared = 1;
    }
    write_fight(arena, &fight);
    arena.last_slot = slot;
    Ok(())
}

fn rule(err: LogicError) -> Error {
    match err {
        LogicError::BadIntent => error!(GameError::BadAmount),
        _ => error!(GameError::NotReady),
    }
}

#[derive(Accounts)]
pub struct TickArena<'info> {
    #[account(mut, seeds = [ARENA_SEED, arena.load()?.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
}
