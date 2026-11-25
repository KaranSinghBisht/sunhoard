//! The Noonless Crater. `enter_lair` runs the Glare against World; the crank
//! ticks the visit; every 5 steps damage flushes into the shared HP pool.

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
use super::dungeon::weapon_of;
use super::lair_io::{read_lair, write_lair};
use super::lair_tally::{ensure_row, flush, heal};
use crate::errors::GameError;
use crate::logic::lair::{open_lair, scoopable, step_lair, FLUSH_STEPS, GLARE_MIN_HUNDREDTHS};
use crate::logic::numbers::{FIGHT_ITERATIONS, TICK_MILLIS, TICK_MIN_SLOTS};
use crate::logic::Weapon;
use crate::state::{
    Arena, Inventory, Player, Purse, Season, World, ARENA_SEED, INVENTORY_SEED, MODE_IDLE,
    MODE_LAIR, MODE_WAIT, PLAYER_SEED, PURSE_SEED, SEASON_SEED, WORLD_SEED,
};

pub fn enter(ctx: Context<EnterLair>, discriminator: Vec<u8>) -> Result<()> {
    if ctx.accounts.player.player_number == 0 {
        return err!(GameError::NotReady);
    }
    // The kill is public; only the HP before it is sealed.
    if ctx.accounts.world.hp == 0 {
        return err!(GameError::SunFree);
    }
    let now = Clock::get()?.unix_timestamp;
    let age = wallet_age(&ctx.accounts.player, now);
    let cleared_t1 = ctx.accounts.player.first_clears > 0;
    let (owner, nonce, task) = {
        let arena = &mut ctx.accounts.arena.load_mut()?;
        if arena.mode != MODE_IDLE {
            return err!(GameError::NotReady);
        }
        // The Glare: the enclave compares the private purse with the warmest
        // seen this season. Only the mark is revealed.
        let glints = ctx.accounts.purse.glints;
        let warmest_before = ctx.accounts.world.warmest;
        let marked = glints >= GLARE_MIN_HUNDREDTHS && (warmest_before == 0 || glints > warmest_before);
        let world = &mut ctx.accounts.world;
        if glints > warmest_before {
            world.warmest = glints;
        }
        // The wallet's age and its cellar clear ride on its damage row so the
        // payout can check them.
        ensure_row(
            &mut *ctx.accounts.season.load_mut()?,
            &arena.owner,
            age,
            cleared_t1,
        )?;
        let nonce = arena
            .run_nonce
            .checked_add(1)
            .ok_or(error!(GameError::NotReady))?;
        let task = task_id(&arena.owner, nonce);
        arena.run_nonce = nonce;
        arena.task_id = task;
        arena.mode = MODE_WAIT;
        arena.lair = 1;
        arena.glare = i32::from(marked);
        arena.seed = [0; 32];
        arena.step_index = 0;
        arena.last_slot = 0;
        arena.monster_count = 0;
        arena.cleared = 0;
        arena.unflushed_damage = 0;
        arena.boss_timer = 0;
        arena.boss_phase = 0;
        arena.boss_attack = 0;
        arena.boss_telegraph = 0;
        arena.boss_cd = 0;
        arena.lair_hits = 0;
        arena.spark_count = 0;
        arena.spark_value = 0;
        arena.spark_heal = 0;
        let weapon = weapon_of(&*ctx.accounts.inventory.load()?, &ctx.accounts.player);
        arena.weapon_material = weapon.material;
        arena.weapon_rarity = weapon.rarity;
        arena.weapon_keen = u16::try_from(weapon.keen_ppm).unwrap_or(u16::MAX);
        arena.weapon_brutal = u16::try_from(weapon.brutal_bp).unwrap_or(u16::MAX);
        (arena.owner, nonce, task)
    };
    let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.payer.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: discriminator,
        caller_seed: caller_seed(&owner, nonce),
        accounts_metas: Some(vec![meta(&ctx.accounts.arena.key())]),
        callback_args: Some(nonce.to_le_bytes().to_vec()),
        ..Default::default()
    });
    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
    schedule(&ctx, task)
}

/// Writes the visit seed and opens the fight.
pub fn consume(ctx: Context<LairCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
    let arena = &mut ctx.accounts.arena.load_mut()?;
    if arena.mode != MODE_WAIT || arena.lair == 0 || arena.run_nonce != nonce {
        return err!(GameError::NotReady);
    }
    let marked = arena.glare != 0;
    let sim = open_lair(&randomness, marked).map_err(|_| error!(GameError::NotReady))?;
    arena.seed = randomness;
    write_lair(arena, &sim);
    arena.mode = MODE_LAIR;
    Ok(())
}

/// Stores the move the next lair tick will use.
pub fn input(ctx: Context<LairInput>, dx: i8, dy: i8, attack: u8, dash: u8) -> Result<()> {
    if !(-1..=1).contains(&dx) || !(-1..=1).contains(&dy) || attack > 1 || dash > 1 {
        return err!(GameError::BadAmount);
    }
    let arena = &mut ctx.accounts.arena.load_mut()?;
    if arena.mode != MODE_LAIR {
        return err!(GameError::NotReady);
    }
    arena.intent_dx = dx;
    arena.intent_dy = dy;
    arena.intent_attack = attack;
    arena.intent_dash = dash;
    Ok(())
}

/// One fixed 100 ms step of the visit. Anyone may call it; fewer than 8 slots
/// since the last step does nothing.
pub fn tick(ctx: Context<TickLair>) -> Result<()> {
    let clock = Clock::get()?;
    let slot = clock.slot;
    let arena = &mut *ctx.accounts.arena.load_mut()?;
    if arena.mode != MODE_LAIR {
        return Ok(());
    }
    if arena.last_slot != 0 && slot < arena.last_slot.saturating_add(TICK_MIN_SLOTS) {
        return Ok(());
    }
    let intent = crate::logic::arena::Intent {
        dx: arena.intent_dx,
        dy: arena.intent_dy,
        attack: arena.intent_attack == 1,
        dash: arena.intent_dash == 1,
    };
    let weapon = Weapon {
        material: arena.weapon_material,
        rarity: arena.weapon_rarity,
        keen_ppm: u32::from(arena.weapon_keen),
        brutal_bp: u32::from(arena.weapon_brutal),
    };
    let pot = ctx.accounts.season.load()?.pot;
    let seed = arena.seed;
    let mut sim = read_lair(arena);
    let out = step_lair(&mut sim, intent, &seed, &weapon, pot)
        .map_err(|_| error!(GameError::NotReady))?;
    if let Some((value, heal)) = out.spilled {
        arena.spark_value = u32::try_from(value).unwrap_or(u32::MAX);
        arena.spark_heal = u32::try_from(heal).unwrap_or(u32::MAX);
    }
    if out.drifted > 0 {
        heal(&mut ctx.accounts.world, out.drifted);
    }
    write_lair(arena, &sim);
    arena.last_slot = slot;
    // Every 0.5 s, and when the visit ends, the damage drains the shared pool.
    if out.done || arena.step_index % FLUSH_STEPS == 0 {
        flush(
            arena,
            &mut *ctx.accounts.season.load_mut()?,
            &mut ctx.accounts.world,
            clock.unix_timestamp,
        )?;
    }
    // The visit ends with its timer, with the keeper, or with Old Gloam. The
    // task id stays so `exit_lair` can still stop the crank.
    if out.done || ctx.accounts.world.hp == 0 {
        arena.mode = MODE_IDLE;
        arena.lair = 0;
    }
    Ok(())
}

/// The keeper leaves early: flush what is owed and stop the crank.
pub fn exit(ctx: Context<ExitLair>) -> Result<()> {
    let task = {
        let arena = ctx.accounts.arena.load()?;
        // A cellar run leaves by `exit_dungeon`, not through here.
        let in_cellar = arena.lair == 0 && arena.mode != MODE_IDLE;
        // A visit that ended by itself is idle, but its crank may still be live.
        let nothing_left = arena.mode == MODE_IDLE && arena.task_id == 0;
        if in_cellar || nothing_left {
            return err!(GameError::NotReady);
        }
        arena.task_id
    };
    if task != 0 {
        if ctx.accounts.magic_program.key().to_bytes() != MAGIC_PROGRAM_ID.to_bytes() {
            return err!(GameError::BadAccount);
        }
        crank_ix::cancel(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.task_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
            task,
        )?;
    }
    let now = Clock::get()?.unix_timestamp;
    let arena = &mut *ctx.accounts.arena.load_mut()?;
    flush(
        arena,
        &mut *ctx.accounts.season.load_mut()?,
        &mut ctx.accounts.world,
        now,
    )?;
    arena.mode = MODE_IDLE;
    arena.lair = 0;
    arena.task_id = 0;
    Ok(())
}

/// Scoops a nearby spark into the purse. The spark is a piece of the Sunhoard,
/// so the pot pays for it.
pub fn catch(ctx: Context<CatchSpark>) -> Result<()> {
    let arena = &mut ctx.accounts.arena.load_mut()?;
    if arena.mode != MODE_LAIR {
        return err!(GameError::NotReady);
    }
    let mut sim = read_lair(arena);
    let index = scoopable(&sim, arena.player_x, arena.player_y).ok_or(error!(GameError::NotReady))?;
    let value = {
        let season = &mut *ctx.accounts.season.load_mut()?;
        let value = u64::from(sim.spark_value).min(season.pot);
        season.pot = season.pot.saturating_sub(value);
        value
    };
    ctx.accounts.purse.glints = ctx
        .accounts
        .purse
        .glints
        .checked_add(value)
        .ok_or(error!(GameError::NotReady))?;
    sim.sparks[index].life = 0;
    let live: Vec<crate::logic::Shot> = sim
        .sparks
        .iter()
        .filter(|spark| spark.life > 0)
        .copied()
        .collect();
    arena.spark_count = u8::try_from(live.len()).unwrap_or(u8::MAX);
    for (slot, spark) in arena.sparks.iter_mut().zip(live) {
        slot.x = spark.x;
        slot.y = spark.y;
        slot.vx = spark.vx;
        slot.vy = spark.vy;
        slot.life = spark.life;
        slot.kind = spark.kind;
    }
    Ok(())
}

/// The wallet's age in seconds since it signed up.
fn wallet_age(player: &Player, now: i64) -> u64 {
    if player.born_at == 0 {
        return 0;
    }
    u64::try_from(now.saturating_sub(player.born_at)).unwrap_or(0)
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

fn schedule(ctx: &Context<EnterLair>, task: i64) -> Result<()> {
    if ctx.accounts.magic_program.key().to_bytes() != MAGIC_PROGRAM_ID.to_bytes() {
        return err!(GameError::BadAccount);
    }
    let tick = Instruction {
        program_id: crate::ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.arena.to_account_info().key(), false),
            AccountMeta::new(ctx.accounts.season.to_account_info().key(), false),
            AccountMeta::new(ctx.accounts.world.to_account_info().key(), false),
        ],
        data: anchor_lang::InstructionData::data(&crate::instruction::TickLair {}),
    };
    let payer = ctx.accounts.payer.to_account_info();
    let payer_again = payer.clone();
    let arena = ctx.accounts.arena.to_account_info();
    let season = ctx.accounts.season.to_account_info();
    let world = ctx.accounts.world.to_account_info();
    crank_ix::schedule(
        payer,
        ctx.accounts.magic_program.to_account_info(),
        &[payer_again, arena, season, world],
        ScheduleTaskArgs {
            task_id: task,
            execution_interval_millis: TICK_MILLIS,
            iterations: FIGHT_ITERATIONS,
            instructions: vec![tick],
        },
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
pub struct EnterLair<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [ARENA_SEED, player.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
    #[account(seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[account(mut, seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
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
pub struct LairCb<'info> {
    #[account(mut, seeds = [ARENA_SEED, arena.load()?.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
}

#[derive(Accounts, Session)]
pub struct LairInput<'info> {
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [ARENA_SEED, player.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts)]
pub struct TickLair<'info> {
    #[account(mut, seeds = [ARENA_SEED, arena.load()?.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[account(mut, seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
}

#[derive(Accounts, Session)]
pub struct ExitLair<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [ARENA_SEED, player.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[account(mut, seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
    /// CHECK: MagicBlock magic program. The handler checks its id.
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: The crank's task account. The magic program checks it.
    pub task_context: UncheckedAccount<'info>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts, Session)]
pub struct CatchSpark<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [ARENA_SEED, player.owner.as_ref()], bump)]
    pub arena: AccountLoader<'info, Arena>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
