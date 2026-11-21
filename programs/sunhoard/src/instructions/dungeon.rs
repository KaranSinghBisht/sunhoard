//! Entering a room asks the VRF for its seed and schedules the 100 ms crank.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use ephemeral_rollups_sdk::anchor::{vrf, vrf_callback};
use ephemeral_rollups_sdk::consts::MAGIC_PROGRAM_ID;
use ephemeral_rollups_sdk::vrf::instructions::{
    create_request_scoped_randomness_ix, RequestRandomnessParams,
};
use ephemeral_rollups_sdk::vrf::types::SerializableAccountMeta;
use magicblock_magic_program_api::args::ScheduleTaskArgs;
use session_keys::{Session, SessionTokenV2};
use sha2::{Digest, Sha256};

use super::crank_ix;
use super::fight_io::write_fight;
use crate::errors::GameError;
use crate::logic::numbers::{FIGHT_ITERATIONS, TICK_MILLIS};
use crate::logic::open_room;
use crate::state::{Arena, Player, ARENA_SEED, MODE_FIGHT, MODE_IDLE, MODE_WAIT, PLAYER_SEED};

pub fn enter(mut ctx: Context<EnterDungeon>, discriminator: Vec<u8>) -> Result<()> {
    let (owner, nonce, task) = arm(&mut ctx)?;
    request_seed(&ctx, &discriminator, &owner, nonce)?;
    schedule(&ctx, task)
}

pub fn consume(ctx: Context<DungeonCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
    let arena = &mut ctx.accounts.arena.load_mut()?;
    if arena.mode != MODE_WAIT || arena.run_nonce != nonce {
        return err!(GameError::NotReady);
    }
    let fight = open_room(&randomness).map_err(|_| error!(GameError::NotReady))?;
    write_fight(arena, &fight);
    arena.seed = randomness;
    arena.mode = MODE_FIGHT;
    Ok(())
}

fn arm(ctx: &mut Context<EnterDungeon>) -> Result<(Pubkey, u64, i64)> {
    if ctx.accounts.player.player_number == 0 {
        return err!(GameError::NotReady);
    }
    let arena = &mut ctx.accounts.arena.load_mut()?;
    if arena.mode != MODE_IDLE {
        return err!(GameError::NotReady);
    }
    let nonce = arena
        .run_nonce
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    let task = task_id(&arena.owner, nonce);
    arena.run_nonce = nonce;
    arena.task_id = task;
    arena.mode = MODE_WAIT;
    arena.seed = [0; 32];
    arena.step_index = 0;
    arena.last_slot = 0;
    arena.monster_count = 0;
    arena.intent_dx = 0;
    arena.intent_dy = 0;
    arena.intent_attack = 0;
    arena.intent_dash = 0;
    Ok((arena.owner, nonce, task))
}

fn task_id(owner: &Pubkey, nonce: u64) -> i64 {
    let mut bytes = [0u8; 40];
    bytes[..32].copy_from_slice(owner.as_ref());
    bytes[32..].copy_from_slice(&nonce.to_le_bytes());
    let digest = Sha256::digest(bytes);
    let mut head = [0u8; 8];
    head.copy_from_slice(&digest[..8]);
    let mixed = u64::from_le_bytes(head) & 0x7fff_ffff_ffff_ffff;
    if mixed == 0 {
        1
    } else {
        mixed as i64
    }
}

fn request_seed(
    ctx: &Context<EnterDungeon>,
    discriminator: &[u8],
    owner: &Pubkey,
    nonce: u64,
) -> Result<()> {
    let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.payer.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: discriminator.to_vec(),
        caller_seed: caller_seed(owner, nonce),
        accounts_metas: Some(vec![meta(&ctx.accounts.arena.key())]),
        callback_args: Some(nonce.to_le_bytes().to_vec()),
        ..Default::default()
    });
    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
    Ok(())
}

fn schedule(ctx: &Context<EnterDungeon>, task: i64) -> Result<()> {
    same_magic(&ctx.accounts.magic_program)?;
    let payer = ctx.accounts.payer.to_account_info();
    let payer_again = payer.clone();
    let arena = ctx.accounts.arena.to_account_info();
    let tick = Instruction {
        program_id: crate::ID,
        accounts: vec![AccountMeta::new(*arena.key, false)],
        data: anchor_lang::InstructionData::data(&crate::instruction::TickArena {}),
    };
    crank_ix::schedule(
        payer,
        ctx.accounts.magic_program.to_account_info(),
        &[payer_again, arena],
        ScheduleTaskArgs {
            task_id: task,
            execution_interval_millis: TICK_MILLIS,
            iterations: FIGHT_ITERATIONS,
            instructions: vec![tick],
        },
    )
}

fn same_magic(program: &UncheckedAccount) -> Result<()> {
    if program.key().to_bytes() != MAGIC_PROGRAM_ID.to_bytes() {
        return err!(GameError::BadAccount);
    }
    Ok(())
}

fn caller_seed(owner: &Pubkey, nonce: u64) -> [u8; 32] {
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
pub struct EnterDungeon<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [ARENA_SEED, player.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
    /// CHECK: The VRF queue. The VRF program checks it.
    #[account(mut)]
    pub oracle_queue: UncheckedAccount<'info>,
    /// CHECK: MagicBlock magic program. The handler checks its id.
    pub magic_program: UncheckedAccount<'info>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct DungeonCb<'info> {
    #[account(mut, seeds = [ARENA_SEED, arena.load()?.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
}
