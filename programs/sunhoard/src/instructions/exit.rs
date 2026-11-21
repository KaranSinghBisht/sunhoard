//! Leaves the room, stops the crank, and banks a clear.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use session_keys::{Session, SessionTokenV2};

use super::crank_ix;

use super::fight_io::read_fight;
use super::stack::add_kind;
use crate::errors::GameError;
use crate::logic::ids::KIND_WICKWAX;
use crate::logic::numbers::{CLEAR_GLINT_HUNDREDTHS, CLEAR_WICKWAX};
use crate::logic::room_clear;
use crate::state::{
    Arena, Inventory, Player, Purse, ARENA_SEED, INVENTORY_SEED, MODE_IDLE, PLAYER_SEED, PURSE_SEED,
};

pub fn handle(mut ctx: Context<ExitDungeon>) -> Result<()> {
    let task = {
        let arena = ctx.accounts.arena.load()?;
        if arena.mode == MODE_IDLE {
            return err!(GameError::NotReady);
        }
        arena.task_id
    };
    stop(&ctx, task)?;
    let clear = room_clear(&read_fight(&*ctx.accounts.arena.load()?));
    {
        let arena = &mut ctx.accounts.arena.load_mut()?;
        arena.mode = MODE_IDLE;
        arena.task_id = 0;
    }
    if clear {
        bank(&mut ctx)?;
    }
    Ok(())
}

fn stop(ctx: &Context<ExitDungeon>, task_id: i64) -> Result<()> {
    if task_id == 0 {
        return Ok(());
    }
    if ctx.accounts.magic_program.key().to_bytes() != MAGIC_PROGRAM_ID.to_bytes() {
        return err!(GameError::BadAccount);
    }
    crank_ix::cancel(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.task_context.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
        task_id,
    )
}

fn bank(ctx: &mut Context<ExitDungeon>) -> Result<()> {
    ctx.accounts.player.first_clears = ctx
        .accounts
        .player
        .first_clears
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    ctx.accounts.purse.glints = ctx
        .accounts
        .purse
        .glints
        .checked_add(CLEAR_GLINT_HUNDREDTHS)
        .ok_or(error!(GameError::NotReady))?;
    add_kind(
        &mut *ctx.accounts.inventory.load_mut()?,
        KIND_WICKWAX,
        CLEAR_WICKWAX,
    )
}

#[derive(Accounts, Session)]
pub struct ExitDungeon<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [ARENA_SEED, player.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    /// CHECK: MagicBlock magic program. The handler checks its id.
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: The crank's task account. The magic program checks it.
    pub task_context: UncheckedAccount<'info>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
