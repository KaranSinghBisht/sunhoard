//! Session-signed position. A zone change is not distance-checked, because each zone has its own coordinates.

use anchor_lang::prelude::*;
use session_keys::{Session, SessionTokenV2};

use crate::errors::GameError;
use crate::logic::{move_allowed, MAX_ZONE};
use crate::state::{Player, Presence, PLAYER_SEED, PRESENCE_SEED};

pub fn handle(ctx: Context<PostPosition>, x: u16, y: u16, zone: u8, facing: u8) -> Result<()> {
    if zone > MAX_ZONE {
        return err!(GameError::BadAmount);
    }
    let now = Clock::get()?.unix_timestamp;
    let player = &mut ctx.accounts.player;
    let dt = now.saturating_sub(player.moved_at);
    let changed = zone != player.zone;
    if changed && zone == 0 && (x, y) != (crate::logic::numbers::MEADOW_SPAWN_X, crate::logic::numbers::MEADOW_SPAWN_Y) {
        return err!(GameError::NotReady);
    }
    if !move_allowed(player.x, player.y, x, y, dt, changed) {
        return err!(GameError::NotReady);
    }
    let owner = player.owner;
    player.x = x;
    player.y = y;
    player.zone = zone;
    player.moved_at = now;
    write_presence(
        &mut *ctx.accounts.presence.load_mut()?,
        owner,
        x,
        y,
        zone,
        facing,
        now,
    );
    Ok(())
}

fn write_presence(
    presence: &mut Presence,
    player: Pubkey,
    x: u16,
    y: u16,
    zone: u8,
    facing: u8,
    now: i64,
) {
    let count = usize::from(presence.count).min(presence.rows.len());
    for index in 0..count {
        if presence.rows[index].player == player {
            fill(&mut presence.rows[index], player, x, y, zone, facing, now);
            return;
        }
    }
    if count < presence.rows.len() {
        fill(&mut presence.rows[count], player, x, y, zone, facing, now);
        presence.count = presence.count.saturating_add(1);
        return;
    }
    let mut oldest = 0usize;
    for index in 1..presence.rows.len() {
        if presence.rows[index].updated < presence.rows[oldest].updated {
            oldest = index;
        }
    }
    fill(&mut presence.rows[oldest], player, x, y, zone, facing, now);
}

fn fill(
    row: &mut crate::state::PresenceRow,
    player: Pubkey,
    x: u16,
    y: u16,
    zone: u8,
    facing: u8,
    now: i64,
) {
    row.player = player;
    row.x = x;
    row.y = y;
    row.zone = zone;
    row.facing = facing;
    row.updated = now;
}

#[derive(Accounts, Session)]
pub struct PostPosition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [PRESENCE_SEED], bump)]
    pub presence: AccountLoader<'info, Presence>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
