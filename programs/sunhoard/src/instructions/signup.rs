//! Creates the six player accounts on Solana and prefunds Purse and View permission rent.

use anchor_lang::prelude::*;

use crate::logic::numbers::ENERGY_MAX;
use crate::state::{
    Arena, Inventory, Player, Purse, View, Village, ARENA_SEED, INVENTORY_SEED, PLAYER_SEED,
    PURSE_SEED, VIEW_SEED, VILLAGE_SEED,
};

use super::pay::{pay, permission_rent};

pub fn handle(ctx: Context<SignUp>) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    let now = Clock::get()?.unix_timestamp;
    let player = &mut ctx.accounts.player;
    player.owner = owner;
    player.energy = ENERGY_MAX;
    player.energy_last = now;
    player.moved_at = now;
    player.born_at = now;
    ctx.accounts.purse.owner = owner;
    ctx.accounts.inventory.load_init()?.owner = owner;
    ctx.accounts.village.load_init()?.owner = owner;
    ctx.accounts.arena.load_init()?.owner = owner;
    ctx.accounts.view.owner = owner;
    let rent = permission_rent(1);
    let from = ctx.accounts.owner.to_account_info();
    pay(&from, &ctx.accounts.purse.to_account_info(), rent)?;
    pay(&from, &ctx.accounts.view.to_account_info(), rent)?;
    Ok(())
}

#[derive(Accounts)]
pub struct SignUp<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Player::LEN,
        seeds = [PLAYER_SEED, owner.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,
    #[account(
        init,
        payer = owner,
        space = 8 + Purse::LEN,
        seeds = [PURSE_SEED, owner.key().as_ref()],
        bump
    )]
    pub purse: Account<'info, Purse>,
    #[account(
        init,
        payer = owner,
        space = 8 + Inventory::LEN,
        seeds = [INVENTORY_SEED, owner.key().as_ref()],
        bump
    )]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(
        init,
        payer = owner,
        space = 8 + Village::LEN,
        seeds = [VILLAGE_SEED, owner.key().as_ref()],
        bump
    )]
    pub village: AccountLoader<'info, Village>,
    #[account(
        init,
        payer = owner,
        space = 8 + Arena::LEN,
        seeds = [ARENA_SEED, owner.key().as_ref()],
        bump
    )]
    pub arena: AccountLoader<'info, Arena>,
    #[account(
        init,
        payer = owner,
        space = 8 + View::LEN,
        seeds = [VIEW_SEED, owner.key().as_ref()],
        bump
    )]
    pub view: Account<'info, View>,
    pub system_program: Program<'info, System>,
}
