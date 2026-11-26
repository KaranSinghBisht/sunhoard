//! Leaves the room, stops the crank, and banks the run when the Snuffer fell.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::vrf;
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use ephemeral_rollups_sdk::vrf::instructions::{
    create_request_scoped_randomness_ix, RequestRandomnessParams,
};
use ephemeral_rollups_sdk::vrf::types::SerializableAccountMeta;
use session_keys::{Session, SessionTokenV2};

use super::crank_ix;
use super::fight_io::read_fight;
use super::stack::add_kind;
use crate::errors::GameError;
use crate::logic::ids::KIND_WICKWAX;
use crate::logic::numbers::{CLEAR_GLINT_HUNDREDTHS, CLEAR_WICKWAX, ROOMS_PER_RUN};
use crate::logic::room_clear;
use crate::state::{
    Arena, Inventory, Player, Purse, Season, World, ARENA_SEED, INVENTORY_SEED, MODE_IDLE,
    PLAYER_SEED, PURSE_SEED, SEASON_SEED, WORLD_SEED,
};

pub fn handle(mut ctx: Context<ExitDungeon>, discriminator: Vec<u8>) -> Result<()> {
    let (task, cleared, room) = {
        let arena = ctx.accounts.arena.load()?;
        // A Crater visit leaves by `exit_lair`, which flushes its damage.
        if arena.mode == MODE_IDLE || arena.lair != 0 {
            return err!(GameError::NotReady);
        }
        (arena.task_id, arena.cleared, arena.room)
    };
    stop(&ctx, task)?;
    if cleared != 0 && room == ROOMS_PER_RUN {
        bank(&mut ctx)?;
        request_chest(&ctx, &discriminator)?;
    }
    let arena = &mut ctx.accounts.arena.load_mut()?;
    arena.mode = MODE_IDLE;
    arena.task_id = 0;
    arena.room = 0;
    arena.cleared = 0;
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
    let clear = room_clear(&read_fight(&*ctx.accounts.arena.load()?));
    if !clear {
        return Ok(());
    }
    let mut season = ctx.accounts.season.load_mut()?;
    ctx.accounts.player.cleared_season = season.season_number;
    if season.phase == crate::logic::numbers::PHASE_LONG_NIGHT {
        if let Some(index) = super::lair_tally::find_row(&season, &ctx.accounts.player.owner) {
            season.damage[index].flags |= crate::state::CLEARED_T1;
        }
    }
    drop(season);
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

/// The boss chest roll. The callback pays it; `chest_pending` guards doubles.
fn request_chest(ctx: &Context<ExitDungeon>, discriminator: &[u8]) -> Result<()> {
    let (owner, nonce) = {
        let arena = &mut ctx.accounts.arena.load_mut()?;
        let nonce = arena
            .chest_nonce
            .checked_add(1)
            .ok_or(error!(GameError::NotReady))?;
        arena.chest_nonce = nonce;
        arena.chest_pending = 1;
        (arena.owner, nonce)
    };
    let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.payer.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: discriminator.to_vec(),
        caller_seed: chest_seed(&owner, nonce),
        accounts_metas: Some(vec![
            meta(&ctx.accounts.arena.key()),
            meta(&ctx.accounts.player.key()),
            meta(&ctx.accounts.inventory.key()),
            meta(&ctx.accounts.purse.key()),
            meta(&ctx.accounts.season.key()),
            meta(&ctx.accounts.world.key()),
        ]),
        callback_args: Some(nonce.to_le_bytes().to_vec()),
        ..Default::default()
    });
    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
    Ok(())
}

fn chest_seed(owner: &Pubkey, nonce: u64) -> [u8; 32] {
    let mut seed = [0u8; 32];
    seed[..24].copy_from_slice(&owner.as_ref()[..24]);
    seed[24..].copy_from_slice(&nonce.to_le_bytes());
    seed
}

fn meta(pubkey: &Pubkey) -> SerializableAccountMeta {
    SerializableAccountMeta {
        pubkey: *pubkey,
        is_signer: false,
        is_writable: true,
    }
}

#[vrf]
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
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[account(seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
    /// CHECK: The VRF queue. The VRF program checks it.
    #[account(mut)]
    pub oracle_queue: UncheckedAccount<'info>,
    /// CHECK: MagicBlock magic program. The handler checks its id.
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: The crank's task account. The magic program checks it.
    pub task_context: UncheckedAccount<'info>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
