//! Eating a meal restores energy, at most four meals a day.

use anchor_lang::prelude::*;
use session_keys::{Session, SessionTokenV2};

use crate::errors::GameError;
use crate::logic::ids::KIND_MEAL;
use crate::logic::numbers::{ENERGY_MAX, MEALS_PER_DAY, MEAL_ENERGY};
use crate::state::{Inventory, Player, INVENTORY_SEED, PLAYER_SEED};

use super::stack::{clear_slot, recount};

pub fn handle(ctx: Context<Eat>, slot: u8) -> Result<()> {
    let index = index(slot)?;
    let day = day_of(Clock::get()?.unix_timestamp);
    {
        let player = &mut ctx.accounts.player;
        if player.meals_day != day {
            player.meals_day = day;
            player.meals = 0;
        }
        if player.meals >= MEALS_PER_DAY {
            return err!(GameError::NotReady);
        }
        player.energy = player
            .energy
            .saturating_add(MEAL_ENERGY)
            .min(ENERGY_MAX);
        player.meals = player.meals.saturating_add(1);
    }
    let inventory = &mut *ctx.accounts.inventory.load_mut()?;
    let meal = &mut inventory.slots[index];
    if meal.kind != KIND_MEAL || meal.id != 0 || meal.quantity == 0 || meal.flags != 0 {
        return err!(GameError::BadAmount);
    }
    meal.quantity -= 1;
    if meal.quantity == 0 {
        clear_slot(meal);
    }
    recount(inventory);
    Ok(())
}

fn index(slot: u8) -> Result<usize> {
    let index = usize::from(slot);
    if index >= crate::state::INVENTORY_SLOTS {
        return err!(GameError::BadAmount);
    }
    Ok(index)
}

fn day_of(unix: i64) -> i32 {
    unix.div_euclid(86_400) as i32
}

#[derive(Accounts, Session)]
pub struct Eat<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
