//! Entering a room asks the VRF for its seed and schedules the 100 ms crank.
//! `next_room` advances the run; `chest_cb` pays the boss chest at the end.

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
use super::mint;
use crate::errors::GameError;
use crate::logic::ids::{TRAIT_BRUTAL, TRAIT_KEEN, gear_material, is_gear_kind};
use crate::logic::numbers::{
    BRUTAL_BP_BY_TIER, CHESTS_PER_DAY, FIGHT_ITERATIONS, KEEN_PPM_BY_TIER, PLAYER_HP,
    ROOM_HEAL_BP, ROOMS_PER_RUN, TICK_MILLIS,
};
use crate::logic::{open_room, roll_chest, stone_weapon, Weapon};
use crate::state::{
    Arena, Inventory, Player, Purse, Season, World, ARENA_SEED, DEMO_MODE, INVENTORY_SEED,
    MODE_FIGHT, MODE_IDLE, MODE_WAIT, PLAYER_SEED, PURSE_SEED, SEASON_SEED, WORLD_SEED,
};

pub fn enter(mut ctx: Context<EnterDungeon>, discriminator: Vec<u8>) -> Result<()> {
    let (owner, nonce, task) = arm(&mut ctx)?;
    request_seed(&ctx, &discriminator, &owner, nonce)?;
    schedule(&ctx, task)
}

/// Advances to the next room of the same run. The previous room must be cleared.
pub fn next_room(mut ctx: Context<NextRoom>, discriminator: Vec<u8>) -> Result<()> {
    let (owner, nonce, task, old_task) = rearm(&mut ctx)?;
    stop(&ctx, old_task)?;
    request_seed_next(&ctx, &discriminator, &owner, nonce)?;
    schedule_next(&ctx, task)
}

/// Writes the room seed. The bytes are not logged.
pub fn consume(ctx: Context<DungeonCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
    let arena = &mut ctx.accounts.arena.load_mut()?;
    if arena.mode != MODE_WAIT || arena.run_nonce != nonce {
        return err!(GameError::NotReady);
    }
    let room = arena.room;
    let start_hp = i32::from(arena.carry_hp);
    let fight = open_room(&randomness, room, start_hp).map_err(|_| error!(GameError::NotReady))?;
    write_fight(arena, &fight);
    arena.seed = randomness;
    arena.mode = MODE_FIGHT;
    Ok(())
}

/// Pays the boss chest: the glow rolled at the kill lands here.
pub fn consume_chest(
    mut ctx: Context<ChestCb>,
    randomness: [u8; 32],
    nonce: u64,
) -> Result<()> {
    let (demo, chests_today, first) = {
        let arena = ctx.accounts.arena.load()?;
        if arena.chest_pending == 0 || arena.chest_nonce != nonce {
            return err!(GameError::NotReady);
        }
        let demo = ctx.accounts.season.load()?.flags & DEMO_MODE != 0;
        let player = &ctx.accounts.player;
        let day = day_of(Clock::get()?.unix_timestamp);
        let mut chests_today = player.chests[0];
        if player.chests_day != day {
            chests_today = 0;
        }
        (demo, chests_today, chests_today == 0)
    };
    let roll = roll_chest(
        &randomness,
        demo,
        u8::try_from(chests_today).unwrap_or(CHESTS_PER_DAY),
    )
    .map_err(|_| error!(GameError::NotReady))?;
    pay_chest(&mut ctx, &roll, &randomness, first)?;
    {
        let arena = &mut ctx.accounts.arena.load_mut()?;
        arena.chest_pending = 0;
    }
    let player = &mut ctx.accounts.player;
    let day = day_of(Clock::get()?.unix_timestamp);
    if player.chests_day != day {
        player.chests_day = day;
        player.chests[0] = 0;
    }
    player.chests[0] = player
        .chests[0]
        .saturating_add(1)
        .min(u16::from(CHESTS_PER_DAY) + 1);
    Ok(())
}

fn pay_chest(
    ctx: &mut Context<ChestCb>,
    roll: &crate::logic::chest::ChestRoll,
    randomness: &[u8; 32],
    first: bool,
) -> Result<()> {
    let purse = &mut ctx.accounts.purse;
    purse.glints = purse
        .glints
        .checked_add(roll.glints)
        .ok_or(error!(GameError::NotReady))?;
    if let Some(rarity) = roll.gear_rarity {
        let kind = crate::logic::chest::chest_gear_kind(randomness);
        mint::gear(
            &mut ctx.accounts.player,
            &mut *ctx.accounts.inventory.load_mut()?,
            kind,
            rarity,
        )?;
    }
    if let Some(shell) = roll.shell {
        let epoch = ctx.accounts.world.epoch;
        let salt = ctx
            .accounts
            .world
            .salts
            .get(usize::from(epoch))
            .copied()
            .ok_or(error!(GameError::NotReady))?;
        mint::shell(
            &mut ctx.accounts.player,
            &mut *ctx.accounts.inventory.load_mut()?,
            &salt,
            epoch,
            shell,
        )?;
    }
    if first {
        let epoch = ctx.accounts.world.epoch;
        let salt = ctx
            .accounts
            .world
            .salts
            .get(usize::from(epoch))
            .copied()
            .ok_or(error!(GameError::NotReady))?;
        mint::shell(
            &mut ctx.accounts.player,
            &mut *ctx.accounts.inventory.load_mut()?,
            &salt,
            epoch,
            crate::logic::ids::SHELL_BOSS,
        )?;
    }
    Ok(())
}

fn day_of(unix: i64) -> i32 {
    unix.div_euclid(86_400) as i32
}

fn arm(ctx: &mut Context<EnterDungeon>) -> Result<(Pubkey, u64, i64)> {
    if ctx.accounts.player.player_number == 0 {
        return err!(GameError::NotReady);
    }
    let weapon = weapon_of(&*ctx.accounts.inventory.load()?, &ctx.accounts.player);
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
    arena.lair = 0;
    arena.room = 1;
    arena.carry_hp = u8::try_from(PLAYER_HP).unwrap_or(u8::MAX);
    arena.weapon_material = weapon.material;
    arena.weapon_rarity = weapon.rarity;
    arena.weapon_keen = u16::try_from(weapon.keen_ppm).unwrap_or(u16::MAX);
    arena.weapon_brutal = u16::try_from(weapon.brutal_bp).unwrap_or(u16::MAX);
    arena.seed = [0; 32];
    arena.step_index = 0;
    arena.last_slot = 0;
    arena.monster_count = 0;
    arena.cleared = 0;
    arena.chest_pending = 0;
    arena.intent_dx = 0;
    arena.intent_dy = 0;
    arena.intent_attack = 0;
    arena.intent_dash = 0;
    Ok((arena.owner, nonce, task))
}

fn rearm(ctx: &mut Context<NextRoom>) -> Result<(Pubkey, u64, i64, i64)> {
    if ctx.accounts.player.player_number == 0 {
        return err!(GameError::NotReady);
    }
    let arena = &mut ctx.accounts.arena.load_mut()?;
    // The room was cleared in the last tick: the arena is still MODE_FIGHT
    // with `cleared` set. A run advances only from that state.
    if arena.cleared == 0 || arena.room == 0 || arena.room >= ROOMS_PER_RUN {
        return err!(GameError::NotReady);
    }
    let old_task = arena.task_id;
    let nonce = arena
        .run_nonce
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    let task = task_id(&arena.owner, nonce);
    arena.run_nonce = nonce;
    arena.task_id = task;
    arena.mode = MODE_WAIT;
    arena.room = arena.room.saturating_add(1);
    arena.carry_hp = u8::try_from(heal_after_room(i32::from(arena.carry_hp), arena.player_hp))
        .unwrap_or(u8::MAX);
    arena.seed = [0; 32];
    arena.step_index = 0;
    arena.last_slot = 0;
    arena.monster_count = 0;
    arena.cleared = 0;
    arena.intent_dx = 0;
    arena.intent_dy = 0;
    arena.intent_attack = 0;
    arena.intent_dash = 0;
    Ok((arena.owner, nonce, task, old_task))
}

/// The lantern between rooms restores 30% of the HP missing at the room's end.
fn heal_after_room(carry_hp: i32, ended_hp: i32) -> i32 {
    let missing = (PLAYER_HP - ended_hp).max(0);
    let healed = ended_hp + missing * ROOM_HEAL_BP / 10_000;
    healed.clamp(1, PLAYER_HP).max(carry_hp.min(PLAYER_HP))
}

/// The equipped gear, with its two combat traits. The starter stone axe otherwise.
pub(crate) fn weapon_of(inventory: &Inventory, player: &Player) -> Weapon {
    let slot = usize::from(player.equipped_slot);
    if player.equipped_slot == u8::MAX || slot >= inventory.slots.len() {
        return stone_weapon();
    }
    let item = &inventory.slots[slot];
    if !is_gear_kind(item.kind) {
        return stone_weapon();
    }
    let mut weapon = Weapon {
        material: gear_material(item.kind),
        rarity: item.rarity,
        keen_ppm: 0,
        brutal_bp: 0,
    };
    for pair in item.traits.iter() {
        let tier = usize::from(pair.tier).min(5);
        match pair.id {
            TRAIT_KEEN => weapon.keen_ppm = KEEN_PPM_BY_TIER[tier],
            TRAIT_BRUTAL => weapon.brutal_bp = BRUTAL_BP_BY_TIER[tier],
            _ => {}
        }
    }
    weapon
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

fn request_seed_next(
    ctx: &Context<NextRoom>,
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
    schedule_with(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.arena.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
        task,
    )
}

fn schedule_next(ctx: &Context<NextRoom>, task: i64) -> Result<()> {
    schedule_with(
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.arena.to_account_info(),
        ctx.accounts.magic_program.to_account_info(),
        task,
    )
}

fn schedule_with<'info>(
    payer: AccountInfo<'info>,
    arena: AccountInfo<'info>,
    magic_program: AccountInfo<'info>,
    task: i64,
) -> Result<()> {
    if magic_program.key().to_bytes() != MAGIC_PROGRAM_ID.to_bytes() {
        return err!(GameError::BadAccount);
    }
    let tick = Instruction {
        program_id: crate::ID,
        accounts: vec![AccountMeta::new(*arena.key, false)],
        data: anchor_lang::InstructionData::data(&crate::instruction::TickArena {}),
    };
    let payer_again = payer.clone();
    crank_ix::schedule(
        payer,
        magic_program,
        &[payer_again, arena],
        ScheduleTaskArgs {
            task_id: task,
            execution_interval_millis: TICK_MILLIS,
            iterations: FIGHT_ITERATIONS,
            instructions: vec![tick],
        },
    )
}

fn stop(ctx: &Context<NextRoom>, task_id: i64) -> Result<()> {
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
    #[account(seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[vrf]
#[derive(Accounts, Session)]
pub struct NextRoom<'info> {
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
    /// CHECK: The crank's task account. The magic program checks it.
    pub task_context: UncheckedAccount<'info>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct DungeonCb<'info> {
    #[account(mut, seeds = [ARENA_SEED, arena.load()?.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct ChestCb<'info> {
    #[account(mut, seeds = [ARENA_SEED, arena.load()?.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[account(seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[account(seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
}
