//! Opens a season: the first, or the next one once Old Gloam has fallen. The
//! salt is written only by the VRF callback and is never logged.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{vrf, vrf_callback};
use ephemeral_rollups_sdk::vrf::instructions::{
    create_request_scoped_randomness_ix, RequestRandomnessParams,
};
use ephemeral_rollups_sdk::vrf::types::SerializableAccountMeta;

use crate::errors::GameError;
use crate::logic::numbers::{
    GLOAM_HP_DEMO, GLOAM_HP_LIVE, LONG_NIGHT_DEMO_SECS, LONG_NIGHT_LIVE_SECS, PHASE_LONG_NIGHT,
    SALT_RELEASE_SECS,
};
use crate::logic::sealed_hp;
use crate::state::{
    DamageSlot, Player, Season, World, DEMO_MODE, HAS_EMBER, HAS_KILLER, PLAYER_SEED,
    SALT_PENDING, SEASON_SEED, WORLD_SEED, WYRM_NAME_LEN,
};
use bytemuck::Zeroable;
use session_keys::{Session, SessionTokenV2};

pub fn request(ctx: Context<StartSeason>, discriminator: Vec<u8>) -> Result<()> {
    {
        let season = &mut ctx.accounts.season.load_mut()?;
        // The first season opens freely; a later one only after the wyrm has fallen.
        if season.season_number != 0 && season.flags & HAS_KILLER == 0 {
            return err!(GameError::NotReady);
        }
        let now = Clock::get()?.unix_timestamp;
        if season.flags & SALT_PENDING != 0 {
            // A dropped callback must not brick the season: after the release window
            // the admin may ask the VRF again. `phase_started` holds the request time.
            let waited = now.saturating_sub(season.phase_started);
            if waited >= 0 && waited < SALT_RELEASE_SECS {
                return err!(GameError::NotReady);
            }
        }
        season.flags |= SALT_PENDING;
        season.phase_started = now;
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
        if season.flags & SALT_PENDING == 0 {
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
    let season = &mut ctx.accounts.season.load_mut()?;
    write_world(&mut ctx.accounts.world, randomness, hp, season.season_number == 0);
    season.season_number = season
        .season_number
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    season.phase = PHASE_LONG_NIGHT;
    season.phase_started = now;
    season.phase_ends = ends;
    clear_slayers(season);
    Ok(())
}

/// A new night starts with an empty damage table and no killer. The pot and
/// the wyrm's name carry over; an unused Ember Egg does not.
fn clear_slayers(season: &mut Season) {
    season.flags &= !(SALT_PENDING | HAS_KILLER | HAS_EMBER);
    season.killer = Pubkey::default();
    season.ember_holder = Pubkey::default();
    season.total_damage = 0;
    season.damage_len = 0;
    for slot in season.damage.iter_mut() {
        *slot = DamageSlot::zeroed();
    }
}

/// The Ember Egg holder names the next wyrm (A–Z and spaces, at most 16 chars).
pub fn name_wyrm(ctx: Context<NameWyrm>, name: String) -> Result<()> {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed.len() > WYRM_NAME_LEN
        || !trimmed.bytes().all(|b| b.is_ascii_uppercase() || b == b' ')
    {
        return err!(GameError::BadAmount);
    }
    let season = &mut ctx.accounts.season.load_mut()?;
    if season.flags & HAS_EMBER == 0 || season.ember_holder != ctx.accounts.player.owner {
        return err!(GameError::NotReady);
    }
    season.wyrm_name = [0; WYRM_NAME_LEN];
    season.wyrm_name[..trimmed.len()].copy_from_slice(trimmed.as_bytes());
    season.flags &= !HAS_EMBER;
    Ok(())
}

/// Each season seals its loot under its own salt. Four are kept, so a shell
/// stays thawable for three seasons after the one that dropped it.
fn write_world(world: &mut World, randomness: [u8; 32], hp: u64, first: bool) {
    let epoch = if first {
        0
    } else {
        (usize::from(world.epoch) + 1) % world.salts.len()
    };
    world.salts[epoch] = randomness;
    world.epoch = epoch as u8;
    world.hp = hp;
    world.max_hp = hp;
    world.warmest = 0;
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

#[derive(Accounts, Session)]
pub struct NameWyrm<'info> {
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
