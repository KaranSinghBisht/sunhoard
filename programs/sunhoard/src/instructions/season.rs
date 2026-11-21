//! Opens season 1. The salt is written only by the VRF callback and is never logged.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{vrf, vrf_callback};
use ephemeral_rollups_sdk::vrf::instructions::{
    create_request_scoped_randomness_ix, RequestRandomnessParams,
};
use ephemeral_rollups_sdk::vrf::types::SerializableAccountMeta;

use crate::errors::GameError;
use crate::logic::numbers::{
    GLOAM_HP_DEMO, GLOAM_HP_LIVE, LONG_NIGHT_DEMO_SECS, LONG_NIGHT_LIVE_SECS, PHASE_LONG_NIGHT,
};
use crate::logic::sealed_hp;
use crate::state::{Season, World, DEMO_MODE, SALT_PENDING, SEASON_SEED, WORLD_SEED};

pub fn request(ctx: Context<StartSeason>, discriminator: Vec<u8>) -> Result<()> {
    {
        let season = &mut ctx.accounts.season.load_mut()?;
        if season.season_number != 0 || season.flags & SALT_PENDING != 0 {
            return err!(GameError::NotReady);
        }
        season.flags |= SALT_PENDING;
    }
    let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.admin.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: discriminator,
        caller_seed: [0u8; 32],
        accounts_metas: Some(vec![
            meta(&ctx.accounts.season.key()),
            meta(&ctx.accounts.world.key()),
        ]),
        ..Default::default()
    });
    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.admin.to_account_info(), &ix)?;
    Ok(())
}

pub fn consume(ctx: Context<SaltCb>, randomness: [u8; 32]) -> Result<()> {
    let demo = {
        let season = ctx.accounts.season.load()?;
        if season.season_number != 0 || season.flags & SALT_PENDING == 0 {
            return err!(GameError::NotReady);
        }
        season.flags & DEMO_MODE != 0
    };
    let base = if demo { GLOAM_HP_DEMO } else { GLOAM_HP_LIVE };
    let hp = sealed_hp(base, &randomness).map_err(|_| error!(GameError::NotReady))?;
    let now = Clock::get()?.unix_timestamp;
    let length = if demo {
        LONG_NIGHT_DEMO_SECS
    } else {
        LONG_NIGHT_LIVE_SECS
    };
    let ends = now.checked_add(length).ok_or(error!(GameError::NotReady))?;
    write_world(&mut ctx.accounts.world, randomness, hp);
    let season = &mut ctx.accounts.season.load_mut()?;
    season.season_number = 1;
    season.phase = PHASE_LONG_NIGHT;
    season.phase_started = now;
    season.phase_ends = ends;
    season.flags &= !SALT_PENDING;
    Ok(())
}

fn write_world(world: &mut World, randomness: [u8; 32], hp: u64) {
    world.salts[0] = randomness;
    world.epoch = 0;
    world.hp = hp;
    world.max_hp = hp;
}

fn meta(pubkey: &Pubkey) -> SerializableAccountMeta {
    SerializableAccountMeta {
        pubkey: *pubkey,
        is_signer: false,
        is_writable: true,
    }
}

#[vrf]
#[derive(Accounts)]
pub struct StartSeason<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [SEASON_SEED], bump, has_one = admin)]
    pub season: AccountLoader<'info, Season>,
    #[account(mut, seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
    /// CHECK: The VRF queue. The VRF program checks it.
    #[account(mut)]
    pub oracle_queue: UncheckedAccount<'info>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct SaltCb<'info> {
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[account(mut, seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
}
