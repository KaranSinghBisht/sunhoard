//! Gather pays the base yield now. The callback adds the aberration, or nothing.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{vrf, vrf_callback};
use ephemeral_rollups_sdk::vrf::instructions::{
    create_request_scoped_randomness_ix, RequestRandomnessParams,
};
use ephemeral_rollups_sdk::vrf::types::SerializableAccountMeta;
use session_keys::{Session, SessionTokenV2};

use super::stack::add_kind;
use crate::errors::{GameError, LogicError};
use crate::logic::{
    aurora_up, cooldown_ready, gather_base, gather_callback, in_gather_range, refill_energy,
    ToolBonus,
};
use crate::state::{Inventory, Player, GATHER_PENDING, INVENTORY_SEED, PLAYER_SEED};

pub fn request(
    mut ctx: Context<Gather>,
    node: u8,
    node_x: u16,
    node_y: u16,
    discriminator: Vec<u8>,
) -> Result<()> {
    let (owner, nonce) = prepare(&mut ctx, node, node_x, node_y)?;
    let ix = roll_ix(&ctx, &discriminator, &owner, nonce);
    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
    Ok(())
}

pub fn consume(ctx: Context<GatherCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let (node, used) = take_pending(&mut ctx.accounts.player, nonce)?;
    let tool = tool_bonus(&*ctx.accounts.inventory.load()?, &ctx.accounts.player);
    let extra = gather_callback(node, used, tool, &randomness, aurora_up(now)).map_err(rule)?;
    add_kind(
        &mut *ctx.accounts.inventory.load_mut()?,
        extra.kind,
        extra.qty,
    )
}

fn prepare(ctx: &mut Context<Gather>, node: u8, node_x: u16, node_y: u16) -> Result<(Pubkey, u64)> {
    let now = Clock::get()?.unix_timestamp;
    let (kind, qty, owner, nonce) = {
        let tool = tool_bonus(&*ctx.accounts.inventory.load()?, &ctx.accounts.player);
        let player = &mut ctx.accounts.player;
        let (kind, qty) = charge(player, node, node_x, node_y, now, tool)?;
        let nonce = mark(player, node, now)?;
        (kind, qty, player.owner, nonce)
    };
    add_kind(&mut *ctx.accounts.inventory.load_mut()?, kind, qty)?;
    Ok((owner, nonce))
}

/// The equipped tool's Efficient and Bountiful tiers, as basis points.
pub(crate) fn tool_bonus(inventory: &Inventory, player: &Player) -> ToolBonus {
    let mut bonus = ToolBonus::default();
    let slot = usize::from(player.equipped_slot);
    if player.equipped_slot == u8::MAX || slot >= inventory.slots.len() {
        return bonus;
    }
    let item = &inventory.slots[slot];
    if !crate::logic::ids::is_tool_kind(item.kind) {
        return bonus;
    }
    for pair in item.traits.iter() {
        let tier = usize::from(pair.tier).min(5);
        match pair.id {
            crate::logic::ids::TRAIT_EFFICIENT => bonus.efficient_bp = crate::logic::numbers::EFFICIENT_BP[tier],
            crate::logic::ids::TRAIT_BOUNTIFUL => bonus.bountiful_bp = crate::logic::numbers::BOUNTIFUL_BP[tier],
            _ => {}
        }
    }
    bonus
}

const PENDING_SECS: i64 = 30;
const DAY_SECS: i64 = 86_400;

fn charge(
    player: &mut Player,
    node: u8,
    node_x: u16,
    node_y: u16,
    now: i64,
    tool: ToolBonus,
) -> Result<(u16, u32)> {
    if player.player_number == 0 {
        return err!(GameError::NotReady);
    }
    let (energy, last) = refill_energy(player.energy, player.energy_last, now).map_err(rule)?;
    player.energy = energy;
    player.energy_last = last;
    release_stale(player, now);
    if player.gather_flags & GATHER_PENDING != 0 || !cooldown_ready(player.gather_at, now) {
        return err!(GameError::NotReady);
    }
    if day_of(player.gather_at) != day_of(now) {
        player.energy_used_today = 0;
    }
    if !in_gather_range(player.x, player.y, node_x, node_y) {
        return err!(GameError::NotReady);
    }
    let used = player.energy_used_today;
    let base = gather_base(node, used, tool).map_err(rule)?;
    player.energy = player
        .energy
        .checked_sub(base.energy)
        .ok_or(error!(GameError::NotReady))?;
    player.energy_used_today = used
        .checked_add(base.energy)
        .ok_or(error!(GameError::NotReady))?;
    player.gather_used = used;
    Ok((base.kind, base.qty))
}

fn release_stale(player: &mut Player, now: i64) {
    if player.gather_flags & GATHER_PENDING == 0 {
        return;
    }
    if now.saturating_sub(player.gather_at) >= PENDING_SECS {
        player.gather_flags &= !GATHER_PENDING;
    }
}

fn day_of(unix: i64) -> i64 {
    unix.div_euclid(DAY_SECS)
}

fn mark(player: &mut Player, node: u8, now: i64) -> Result<u64> {
    let nonce = player
        .gather_nonce
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    player.gather_nonce = nonce;
    player.gather_at = now;
    player.gather_node = node;
    player.gather_flags |= GATHER_PENDING;
    Ok(nonce)
}

fn take_pending(player: &mut Player, nonce: u64) -> Result<(u8, u32)> {
    if player.gather_flags & GATHER_PENDING == 0 || player.gather_nonce != nonce {
        return err!(GameError::NotReady);
    }
    player.gather_flags &= !GATHER_PENDING;
    Ok((player.gather_node, player.gather_used))
}

fn roll_ix(
    ctx: &Context<Gather>,
    discriminator: &[u8],
    owner: &Pubkey,
    nonce: u64,
) -> ephemeral_rollups_sdk::compat::Instruction {
    create_request_scoped_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.payer.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: discriminator.to_vec(),
        caller_seed: caller_seed(owner, nonce),
        accounts_metas: Some(vec![
            meta(&ctx.accounts.player.key()),
            meta(&ctx.accounts.inventory.key()),
        ]),
        callback_args: Some(nonce.to_le_bytes().to_vec()),
        ..Default::default()
    })
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

fn rule(err: LogicError) -> Error {
    match err {
        LogicError::BadNode => error!(GameError::BadAmount),
        _ => error!(GameError::NotReady),
    }
}

#[vrf]
#[derive(Accounts, Session)]
pub struct Gather<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    /// CHECK: The VRF queue. The VRF program checks it.
    #[account(mut)]
    pub oracle_queue: UncheckedAccount<'info>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct GatherCb<'info> {
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
}
