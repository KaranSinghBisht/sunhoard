//! The anvil: one rarity up. The strike consumes fodder and Glints now, and
//! one VRF callback decides win or crack.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{vrf, vrf_callback};
use ephemeral_rollups_sdk::vrf::instructions::{
    create_request_scoped_randomness_ix, RequestRandomnessParams,
};
use ephemeral_rollups_sdk::vrf::types::SerializableAccountMeta;
use session_keys::{Session, SessionTokenV2};

use super::stack::{clear_slot, recount, unequip};
use crate::errors::GameError;
use crate::logic::anvil::{heat_after_fail, plan_strike, scrap, HEAT_IDLE_SECS};
use crate::logic::craft::roll_traits;
use crate::logic::ids::{gear_material, is_gear_kind, RARITY_LEGENDARY};
use crate::logic::merchant::fodder_value;
use crate::logic::roll::ppm_of;
use crate::state::{
    Inventory, ItemSlot, Player, Purse, Season, BOUND, CRACKING, FORGING, INVENTORY_SEED,
    INVENTORY_SLOTS, LISTED, PLAYER_SEED, PURSE_SEED, SEALED, SEASON_SEED, STRIKE_PENDING,
};

const PENDING_SECS: i64 = 30;
const MAX_FODDER: usize = 8;

pub fn strike(
    ctx: Context<Strike>,
    slot: u8,
    fodder: Vec<u8>,
    glints: u64,
    discriminator: Vec<u8>,
) -> Result<()> {
    let index = index(slot)?;
    check_fodder(slot, &fodder)?;
    let now = Clock::get()?.unix_timestamp;
    if let Some(lost) = release_stale(&mut ctx.accounts.player, now) {
        // The roll never came back: the item it held is free again.
        ctx.accounts.inventory.load_mut()?.slots[lost].flags &= !FORGING;
    }
    if ctx.accounts.player.strike_flags & STRIKE_PENDING != 0 {
        return err!(GameError::NotReady);
    }
    let (inputs, material, rarity, fee) = {
        let inventory = ctx.accounts.inventory.load()?;
        let item = &inventory.slots[index];
        if !is_gear_kind(item.kind)
            || item.quantity == 0
            || item.rarity >= RARITY_LEGENDARY
            || item.flags & (BOUND | LISTED | CRACKING | SEALED) != 0
        {
            return err!(GameError::BadAmount);
        }
        let mut inputs = glints;
        let item_value = fodder_value(
            item.kind,
            gear_material(item.kind),
            item.rarity,
            item.grade,
            item.purity_bp,
            false,
            false,
        )
        .map_err(|_| error!(GameError::BadAmount))?;
        inputs = inputs
            .checked_add(item_value)
            .ok_or(error!(GameError::NotReady))?;
        for fodder_slot in &fodder {
            let fodder_item = &inventory.slots[usize::from(*fodder_slot)];
            let fodder_index = usize::from(*fodder_slot);
            if fodder_item.quantity == 0
                || fodder_item.flags & (BOUND | LISTED | CRACKING) != 0
                || on_the_anvil(fodder_item, fodder_index, &ctx.accounts.player, now)
            {
                return err!(GameError::BadAmount);
            }
            inputs = inputs
                .checked_add(fodder_worth(fodder_item)?)
                .ok_or(error!(GameError::NotReady))?;
        }
        let material = gear_material(item.kind);
        let rarity = item.rarity;
        let heat = heat_now(&ctx.accounts.player, rarity, now);
        let plan = plan_strike(material, rarity, inputs, heat)
            .map_err(|_| error!(GameError::NotReady))?;
        (inputs, material, rarity, plan.fee)
    };
    let purse = &mut ctx.accounts.purse;
    purse.glints = purse
        .glints
        .checked_sub(fee)
        .and_then(|left| left.checked_sub(glints))
        .ok_or(error!(GameError::BadAmount))?;
    {
        let inventory = &mut *ctx.accounts.inventory.load_mut()?;
        for fodder_slot in &fodder {
            clear_slot(&mut inventory.slots[usize::from(*fodder_slot)]);
            unequip(&mut ctx.accounts.player, usize::from(*fodder_slot));
        }
        inventory.slots[index].flags |= FORGING;
        recount(inventory);
    }
    let player = &mut ctx.accounts.player;
    let nonce = player
        .strike_nonce
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    player.strike_nonce = nonce;
    player.strike_slot = slot;
    player.strike_inputs = inputs;
    player.strike_glints = glints;
    player.strike_at = now;
    player.strike_flags |= STRIKE_PENDING;
    player.heat_at = now;
    let owner = player.owner;
    let _ = (material, rarity);
    let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.payer.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: discriminator,
        caller_seed: caller_seed(&owner, nonce),
        accounts_metas: Some(vec![
            meta(&ctx.accounts.player.key()),
            meta(&ctx.accounts.inventory.key()),
            meta(&ctx.accounts.purse.key()),
            meta(&ctx.accounts.season.key()),
        ]),
        callback_args: Some(nonce.to_le_bytes().to_vec()),
        ..Default::default()
    });
    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
    Ok(())
}

pub fn consume(ctx: Context<StrikeCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let (slot, inputs, glints) = {
        let player = &ctx.accounts.player;
        if player.strike_flags & STRIKE_PENDING == 0 || player.strike_nonce != nonce {
            return err!(GameError::NotReady);
        }
        (player.strike_slot, player.strike_inputs, player.strike_glints)
    };
    let (gear_kind, material, rarity) = {
        let inventory = ctx.accounts.inventory.load()?;
        let item = &inventory.slots[usize::from(slot)];
        if item.flags & FORGING == 0 || item.rarity >= RARITY_LEGENDARY {
            return err!(GameError::NotReady);
        }
        (item.kind, gear_material(item.kind), item.rarity)
    };
    let heat = heat_now(&ctx.accounts.player, rarity, now);
    let plan = plan_strike(material, rarity, inputs, heat)
        .map_err(|_| error!(GameError::NotReady))?;
    let stake = plan
        .fee
        .checked_add(glints)
        .ok_or(error!(GameError::NotReady))?;
    let roll = ppm_of(u32::from_le_bytes([randomness[0], randomness[1], randomness[2], randomness[3]]));
    let won = u64::from(roll) < plan.odds_bp.saturating_mul(100);
    let season = &mut *ctx.accounts.season.load_mut()?;
    if won {
        season.burned = season
            .burned
            .checked_add(stake)
            .ok_or(error!(GameError::NotReady))?;
    } else {
        season.pot = season
            .pot
            .checked_add(stake)
            .ok_or(error!(GameError::NotReady))?;
    }
    let player = &mut ctx.accounts.player;
    player.heat_at = now;
    if won {
        player.heat[usize::from(rarity + 1)] = 0;
    } else {
        player.heat[usize::from(rarity + 1)] = heat_after_fail(heat);
    }
    let mut inventory = ctx.accounts.inventory.load_mut()?;
    if won {
        let item = &mut inventory.slots[usize::from(slot)];
        let new_rarity = item.rarity.saturating_add(1);
        let rolled =
            roll_traits(gear_kind, new_rarity, &randomness).map_err(|_| error!(GameError::NotReady))?;
        item.rarity = new_rarity;
        item.flags &= !FORGING;
        let slots = usize::from(crate::logic::numbers::RARITY_SLOTS[usize::from(new_rarity)]);
        for (index, pair) in rolled.iter().enumerate().take(slots) {
            item.traits[index] = crate::state::TraitPair {
                id: pair.id,
                tier: pair.tier,
            };
        }
    } else {
        let back = scrap(inputs).map_err(|_| error!(GameError::NotReady))?;
        ctx.accounts.purse.glints = ctx
            .accounts
            .purse
            .glints
            .checked_add(back)
            .ok_or(error!(GameError::NotReady))?;
        {
            let item = &mut inventory.slots[usize::from(slot)];
            clear_slot(item);
        }
        recount(&mut inventory);
        unequip(&mut ctx.accounts.player, usize::from(slot));
    }
    let player = &mut ctx.accounts.player;
    player.strike_flags &= !STRIKE_PENDING;
    Ok(())
}

/// What one fodder slot adds to the strike. A stack is consumed whole, so
/// every unit in it counts.
fn fodder_worth(item: &ItemSlot) -> Result<u64> {
    let is_block = item.id != 0 && item.kind == 0;
    let each = fodder_value(
        item.kind,
        gear_material(item.kind),
        item.rarity,
        item.grade,
        item.purity_bp,
        item.flags & SEALED != 0,
        is_block,
    )
    .map_err(|_| error!(GameError::BadAmount))?;
    let units = if item.id == 0 { u64::from(item.quantity) } else { 1 };
    each.checked_mul(units).ok_or(error!(GameError::NotReady))
}

/// Fodder slots must be in the pack, must not repeat, and must not be the
/// item on the anvil. A repeated slot would count its value twice.
fn check_fodder(slot: u8, fodder: &[u8]) -> Result<()> {
    if fodder.len() > MAX_FODDER {
        return err!(GameError::BadAmount);
    }
    for (place, fodder_slot) in fodder.iter().enumerate() {
        let repeated = fodder[..place].contains(fodder_slot);
        if usize::from(*fodder_slot) >= INVENTORY_SLOTS || *fodder_slot == slot || repeated {
            return err!(GameError::BadAmount);
        }
    }
    Ok(())
}

/// A roll lost for 30 s is given up: the stake stays spent. Returns the slot
/// the lost strike was holding, so the caller can unmark its item.
fn release_stale(player: &mut Player, now: i64) -> Option<usize> {
    if player.strike_flags & STRIKE_PENDING == 0 || !lost(player, now) {
        return None;
    }
    player.strike_flags &= !STRIKE_PENDING;
    let slot = usize::from(player.strike_slot);
    (slot < INVENTORY_SLOTS).then_some(slot)
}

fn lost(player: &Player, now: i64) -> bool {
    now.saturating_sub(player.strike_at) >= PENDING_SECS
}

/// True while the item waits on a live strike roll. An item whose roll was
/// lost is no longer held, so it can be sold or listed again.
pub(crate) fn on_the_anvil(item: &ItemSlot, slot: usize, player: &Player, now: i64) -> bool {
    item.flags & FORGING != 0
        && player.strike_flags & STRIKE_PENDING != 0
        && usize::from(player.strike_slot) == slot
        && !lost(player, now)
}

fn heat_now(player: &Player, rarity: u8, now: i64) -> u16 {
    if now.saturating_sub(player.heat_at) >= HEAT_IDLE_SECS {
        return 0;
    }
    player.heat[usize::from(rarity + 1)]
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

fn index(slot: u8) -> Result<usize> {
    let index = usize::from(slot);
    if index >= crate::state::INVENTORY_SLOTS {
        return err!(GameError::BadAmount);
    }
    Ok(index)
}

#[vrf]
#[derive(Accounts, Session)]
pub struct Strike<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    /// CHECK: The VRF queue. The VRF program checks it.
    #[account(mut)]
    pub oracle_queue: UncheckedAccount<'info>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct StrikeCb<'info> {
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
}
