//! The player's latest move. The crank reads it on the next tick.

use anchor_lang::prelude::*;
use session_keys::{Session, SessionTokenV2};

use crate::errors::GameError;
use crate::state::{Arena, Player, ARENA_SEED, MODE_FIGHT, PLAYER_SEED};

pub fn handle(ctx: Context<ArenaInput>, dx: i8, dy: i8, attack: u8, dash: u8) -> Result<()> {
    if !(-1..=1).contains(&dx) || !(-1..=1).contains(&dy) || attack > 1 || dash > 1 {
        return err!(GameError::BadAmount);
    }
    let arena = &mut ctx.accounts.arena.load_mut()?;
    if arena.mode != MODE_FIGHT {
        return err!(GameError::NotReady);
    }
    arena.intent_dx = dx;
    arena.intent_dy = dy;
    arena.intent_attack = attack;
    arena.intent_dash = dash;
    Ok(())
}

#[derive(Accounts, Session)]
pub struct ArenaInput<'info> {
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [ARENA_SEED, player.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
