//! The workbench. Material recipes pay out at once; gear recipes consume the
//! inputs now and wait for one VRF callback that rolls rarity and traits.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{vrf, vrf_callback};
use ephemeral_rollups_sdk::vrf::instructions::{
    create_request_scoped_randomness_ix, RequestRandomnessParams,
};
use ephemeral_rollups_sdk::vrf::types::SerializableAccountMeta;
use session_keys::{Session, SessionTokenV2};

use super::mint;
use super::stack::{add_kind, take_inputs};
use crate::errors::GameError;
use crate::logic::craft::{is_gear_recipe, recipe_by_id, roll_rarity, roll_traits};
use crate::state::{
    Inventory, Player, Village, CRAFT_PENDING, INVENTORY_SEED, PLAYER_SEED, VILLAGE_SEED,
};

const PENDING_SECS: i64 = 30;

pub fn request(mut ctx: Context<Craft>, recipe_id: u8, discriminator: Vec<u8>) -> Result<()> {
    let recipe = recipe_by_id(recipe_id).map_err(|_| error!(GameError::BadAmount))?;
    let (owner, nonce) = prepare(&mut ctx, &recipe)?;
    if !is_gear_recipe(&recipe) {
        match recipe_id {
            crate::logic::numbers::RECIPE_POST => build_post(&mut ctx)?,
            crate::logic::numbers::RECIPE_BED => build_bed(&mut ctx)?,
            crate::logic::numbers::RECIPE_WORKSTATION => build_workstation(&mut ctx)?,
            _ => add_kind(
                &mut *ctx.accounts.inventory.load_mut()?,
                recipe.output_kind,
                u32::from(recipe.output_qty),
            )?,
        }
        return Ok(());
    }
    mark(&mut ctx, recipe_id, now()?)?;
    let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.payer.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: discriminator,
        caller_seed: caller_seed(&owner, nonce),
        accounts_metas: Some(vec![
            meta(&ctx.accounts.player.key()),
            meta(&ctx.accounts.inventory.key()),
        ]),
        callback_args: Some(nonce.to_le_bytes().to_vec()),
        ..Default::default()
    });
    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
    Ok(())
}

pub fn consume(ctx: Context<CraftCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
    let recipe_id = {
        let player = &ctx.accounts.player;
        if player.craft_flags & CRAFT_PENDING == 0 || player.craft_nonce != nonce {
            return err!(GameError::NotReady);
        }
        player.craft_recipe
    };
    let recipe = recipe_by_id(recipe_id).map_err(|_| error!(GameError::BadAmount))?;
    let rarity = roll_rarity(recipe.gear_kind, &randomness).map_err(|_| error!(GameError::NotReady))?;
    let rolled = roll_traits(recipe.gear_kind, rarity, &randomness)
        .map_err(|_| error!(GameError::NotReady))?;
    let mut traits = [crate::state::TraitPair { id: 0, tier: 0 }; 4];
    for (index, pair) in rolled.iter().enumerate() {
        traits[index] = crate::state::TraitPair {
            id: pair.id,
            tier: pair.tier,
        };
    }
    // Hold the pack before clearing the pending flag. A full pack refunds the
    // inputs so a lost roll never burns materials.
    {
        let mut inventory = ctx.accounts.inventory.load_mut()?;
        let index = match super::stack::find_empty(&inventory) {
            Some(index) => index,
            None => {
                drop(inventory);
                ctx.accounts.player.craft_flags &= !CRAFT_PENDING;
                refund(&mut *ctx.accounts.inventory.load_mut()?, recipe_id)?;
                return err!(GameError::Full);
            }
        };
        let id = mint::next_item_id(&mut ctx.accounts.player)?;
        mint::fill_gear(&mut inventory.slots[index], id, recipe.gear_kind, rarity, traits);
        super::stack::recount(&mut inventory);
    }
    ctx.accounts.player.craft_flags &= !CRAFT_PENDING;
    Ok(())
}

fn prepare(ctx: &mut Context<Craft>, recipe: &crate::logic::craft::Recipe) -> Result<(Pubkey, u64)> {
    if ctx.accounts.player.player_number == 0 {
        return err!(GameError::NotReady);
    }
    {
        let inventory = &mut *ctx.accounts.inventory.load_mut()?;
        release_stale(&mut ctx.accounts.player, inventory)?;
    }
    if ctx.accounts.player.craft_flags & CRAFT_PENDING != 0 {
        return err!(GameError::NotReady);
    }
    take_inputs(
        &mut *ctx.accounts.inventory.load_mut()?,
        &recipe.ingredients[..usize::from(recipe.ingredient_count)],
    )?;
    let nonce = ctx
        .accounts
        .player
        .craft_nonce
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    ctx.accounts.player.craft_nonce = nonce;
    Ok((ctx.accounts.player.owner, nonce))
}

fn mark(ctx: &mut Context<Craft>, recipe_id: u8, at: i64) -> Result<()> {
    let player = &mut ctx.accounts.player;
    player.craft_recipe = recipe_id;
    player.craft_at = at;
    player.craft_flags |= CRAFT_PENDING;
    Ok(())
}

/// Puts the gear recipe's inputs back. Used when the roll is lost or the pack is full.
fn refund(inventory: &mut Inventory, recipe_id: u8) -> Result<()> {
    let recipe = recipe_by_id(recipe_id).map_err(|_| error!(GameError::BadAmount))?;
    for ingredient in &recipe.ingredients[..usize::from(recipe.ingredient_count)] {
        add_kind(inventory, ingredient.kind, u32::from(ingredient.qty))?;
    }
    Ok(())
}

/// A lantern post: one more built post slot in the barn.
fn build_post(ctx: &mut Context<Craft>) -> Result<()> {
    let village = &mut *ctx.accounts.village.load_mut()?;
    let post = village
        .posts
        .iter_mut()
        .find(|post| post.flags & crate::state::POST_BUILT == 0)
        .ok_or(error!(GameError::NotReady))?;
    post.flags |= crate::state::POST_BUILT;
    Ok(())
}

/// A bed: one more wanderer can stay.
fn build_bed(ctx: &mut Context<Craft>) -> Result<()> {
    let village = &mut *ctx.accounts.village.load_mut()?;
    village.beds = village
        .beds
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    Ok(())
}

/// A workstation: the next wanderer takes up its profession.
fn build_workstation(ctx: &mut Context<Craft>) -> Result<()> {
    let village = &mut *ctx.accounts.village.load_mut()?;
    let station = village
        .workstations
        .iter_mut()
        .find(|station| **station == 0)
        .ok_or(error!(GameError::NotReady))?;
    *station = crate::logic::ids::PROF_WOODCUTTER;
    Ok(())
}

fn release_stale(player: &mut Player, inventory: &mut Inventory) -> Result<()> {
    if player.craft_flags & CRAFT_PENDING == 0 {
        return Ok(());
    }
    if now()?.saturating_sub(player.craft_at) < PENDING_SECS {
        return Ok(());
    }
    let recipe_id = player.craft_recipe;
    // Refund first. If the pack cannot hold the inputs, keep the pending flag
    // so a later craft (after the keeper frees space) can try again.
    refund(inventory, recipe_id)?;
    player.craft_flags &= !CRAFT_PENDING;
    Ok(())
}

fn now() -> Result<i64> {
    Ok(Clock::get()?.unix_timestamp)
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
pub struct Craft<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [VILLAGE_SEED, player.owner.as_ref()], bump)]
    pub village: AccountLoader<'info, Village>,
    /// CHECK: The VRF queue. The VRF program checks it.
    #[account(mut)]
    pub oracle_queue: UncheckedAccount<'info>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct CraftCb<'info> {
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
}
