//! The barn: lantern posts hold blocks and warm the village; the Hearth Bell
//! calls wanderers; villagers work and eat.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{vrf, vrf_callback};
use ephemeral_rollups_sdk::vrf::instructions::{
    create_request_scoped_randomness_ix, RequestRandomnessParams,
};
use ephemeral_rollups_sdk::vrf::types::SerializableAccountMeta;
use session_keys::{Session, SessionTokenV2};

use super::stack::{clear_slot, recount};
use crate::errors::GameError;
use crate::logic::numbers::BP;
use crate::logic::world::{block_warmth, warmth_bonus_bp};
use crate::state::{
    Inventory, Player, Purse, Village, BELL_PENDING, BOUND, DEMO, HAS_BLOCK, INVENTORY_SEED,
    PLAYER_SEED, POST_BUILT, PRISTINE, PURSE_SEED, SEALED, VILLAGE_SEED, WANDERER,
};

/// Bits a post keeps about the block so take-back can restore them.
const BLOCK_KEEP: u8 = PRISTINE | BOUND | DEMO;

/// Placing a block moves it out of the pack into a built post, and settles
/// the villager stockpile at the old warmth first.
pub fn place_gem(ctx: Context<PlaceGem>, slot: u8) -> Result<()> {
    let index = index(slot, crate::state::INVENTORY_SLOTS)?;
    settle(&mut *ctx.accounts.village.load_mut()?, now()?)?;
    let (id, tone, grade, purity, pattern, keep) = {
        let inventory = ctx.accounts.inventory.load()?;
        let item = &inventory.slots[index];
        // Sealed shells stay in the Thawery; only a revealed block goes in a post.
        if item.id == 0 || item.kind != 0 || item.flags & (SEALED | crate::state::LISTED) != 0 {
            return err!(GameError::BadAmount);
        }
        (
            item.id,
            item.tone,
            item.grade,
            item.purity_bp,
            item.pattern,
            item.flags & BLOCK_KEEP,
        )
    };
    let village = &mut *ctx.accounts.village.load_mut()?;
    let post = village
        .posts
        .iter_mut()
        .find(|post| post.flags & POST_BUILT != 0 && post.flags & HAS_BLOCK == 0)
        .ok_or(error!(GameError::NotReady))?;
    post.id = id;
    post.tone = tone;
    post.grade = grade;
    post.purity_bp = purity;
    post.pattern = pattern;
    // Keep pristine / bound / demo so take-back restores the same block.
    post.flags = (post.flags & POST_BUILT) | HAS_BLOCK | keep;
    let inventory = &mut *ctx.accounts.inventory.load_mut()?;
    if inventory.slots[index].revealed_key != [0; 32] {
        post.escrow_slot_plus_one = slot + 1;
        inventory.slots[index].flags |= crate::state::LISTED;
    } else {
        post.escrow_slot_plus_one = 0;
        clear_slot(&mut inventory.slots[index]);
    }
    recount(inventory);
    village.warmth_x100 = warmth_of(village);
    Ok(())
}

/// Taking a block back frees the post and settles at the old warmth.
pub fn take_gem(ctx: Context<TakeGem>, post: u8) -> Result<()> {
    let index = index(post, crate::state::POST_SLOTS)?;
    settle(&mut *ctx.accounts.village.load_mut()?, now()?)?;
    let (id, tone, grade, purity, pattern, keep, reserved) = {
        let village = ctx.accounts.village.load()?;
        let found = &village.posts[index];
        if found.flags & HAS_BLOCK == 0 {
            return err!(GameError::NotReady);
        }
        (
            found.id,
            found.tone,
            found.grade,
            found.purity_bp,
            found.pattern,
            found.flags & BLOCK_KEEP,
            found.escrow_slot_plus_one,
        )
    };
    let inventory = &mut *ctx.accounts.inventory.load_mut()?;
    if let Some(index) = reserved.checked_sub(1) {
        let block = inventory.slots.get_mut(usize::from(index)).ok_or(error!(GameError::BadAccount))?;
        require!(block.id == id && block.flags & crate::state::LISTED != 0, GameError::BadAccount);
        block.flags &= !crate::state::LISTED;
    } else {
    let slot = super::stack::find_empty(inventory).ok_or(error!(GameError::Full))?;
    inventory.slots[slot].id = id;
    inventory.slots[slot].kind = 0;
    inventory.slots[slot].tone = tone;
    inventory.slots[slot].grade = grade;
    inventory.slots[slot].purity_bp = purity;
    inventory.slots[slot].pattern = pattern;
    inventory.slots[slot].quantity = 1;
    inventory.slots[slot].flags = keep;
    }
    recount(inventory);
    let village = &mut *ctx.accounts.village.load_mut()?;
    village.posts[index].id = 0;
    village.posts[index].escrow_slot_plus_one = 0;
    village.posts[index].flags = village.posts[index].flags & POST_BUILT;
    village.warmth_x100 = warmth_of(village);
    Ok(())
}

/// Settles villager output into the stockpile, then pays the pack.
pub fn collect(ctx: Context<Collect>) -> Result<()> {
    settle(&mut *ctx.accounts.village.load_mut()?, now()?)?;
    let (wood, stone, ore, food) = {
        let village = ctx.accounts.village.load()?;
        (
            village.stockpile[0],
            village.stockpile[1],
            village.stockpile[2],
            village.stockpile[3],
        )
    };
    let inventory = &mut *ctx.accounts.inventory.load_mut()?;
    if wood > 0 {
        super::stack::add_kind(inventory, crate::logic::ids::KIND_WOOD, wood)?;
    }
    if stone > 0 {
        super::stack::add_kind(inventory, crate::logic::ids::KIND_STONE, stone)?;
    }
    if ore > 0 {
        super::stack::add_kind(inventory, crate::logic::ids::KIND_ORE, ore)?;
    }
    if food > 0 {
        super::stack::add_kind(inventory, crate::logic::ids::KIND_FOOD, food)?;
    }
    let village = &mut *ctx.accounts.village.load_mut()?;
    village.stockpile = [0; 5];
    village.last_collect = now()?;
    Ok(())
}

/// Feeds the stockpile: villagers eat from it before they work.
pub fn feed(ctx: Context<Feed>, slot: u8) -> Result<()> {
    let index = index(slot, crate::state::INVENTORY_SLOTS)?;
    let village = &mut *ctx.accounts.village.load_mut()?;
    let inventory = &mut *ctx.accounts.inventory.load_mut()?;
    let item = &mut inventory.slots[index];
    if item.kind != crate::logic::ids::KIND_FOOD || item.id != 0 || item.quantity == 0 {
        return err!(GameError::BadAmount);
    }
    let amount = u32::from(item.quantity);
    village.stockpile[3] = village
        .stockpile[3]
        .saturating_add(amount)
        .min(10_000);
    item.quantity -= u16::try_from(amount).unwrap_or(item.quantity);
    if item.quantity == 0 {
        clear_slot(item);
    }
    recount(inventory);
    Ok(())
}

/// Rings the Hearth Bell: a free bed and a workstation, then one VRF roll.
pub fn ring_bell(ctx: Context<RingBell>, discriminator: Vec<u8>) -> Result<()> {
    let now = now()?;
    let (owner, nonce) = {
        let village = &mut *ctx.accounts.village.load_mut()?;
        if village.beds == 0 || !village.workstations.iter().any(|station| *station != 0) {
            return err!(GameError::NotReady);
        }
        require!(now >= village.bell_until, GameError::NotReady);
        require!(village.villagers.iter().any(|v| v.id == 0), GameError::Full);
        let demo = ctx.accounts.season.load()?.flags & crate::state::DEMO_MODE != 0;
        let cooldown = if demo { 30 } else { 2 * 60 * 60 };
        village.bell_until = now.checked_add(cooldown).ok_or(error!(GameError::NotReady))?;
        village.bell_flags |= BELL_PENDING;
        let nonce = u64::try_from(village.bell_until).map_err(|_| error!(GameError::NotReady))?;
        (village.owner, nonce)
    };
    let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.payer.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: discriminator,
        caller_seed: caller_seed(&owner, nonce),
        accounts_metas: Some(vec![
            meta(&ctx.accounts.player.key()),
            meta(&ctx.accounts.village.key()),
        ]),
        callback_args: Some(nonce.to_le_bytes().to_vec()),
        ..Default::default()
    });
    ctx.accounts
        .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
    Ok(())
}

/// The wanderer roll: 60% someone comes, 70% matching the workstation.
pub fn bell_cb(ctx: Context<BellCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
    let village = &mut *ctx.accounts.village.load_mut()?;
    if village.bell_flags & BELL_PENDING == 0 || u64::try_from(village.bell_until) != Ok(nonce) {
        return err!(GameError::NotReady);
    }
    village.bell_flags &= !BELL_PENDING;
    let roll = crate::logic::roll::ppm_of(u32::from_le_bytes([
        randomness[0],
        randomness[1],
        randomness[2],
        randomness[3],
    ]));
    if roll >= 600_000 {
        return Ok(()); // Nobody answered.
    }
    let profession = village
        .workstations
        .iter()
        .copied()
        .find(|station| *station != 0)
        .unwrap_or(crate::logic::ids::PROF_WOODCUTTER);
    // 70% the wanderer matches the workstation; otherwise any profession.
    let matched = crate::logic::roll::ppm_of(u32::from_le_bytes([
        randomness[4],
        randomness[5],
        randomness[6],
        randomness[7],
    ]));
    let chosen = if matched < 700_000 {
        profession
    } else {
        crate::logic::ids::PROF_WOODCUTTER
    };
    let slot = village
        .villagers
        .iter_mut()
        .find(|villager| villager.id == 0)
        .ok_or(error!(GameError::NotReady))?;
    slot.id = super::mint::next_item_id(&mut ctx.accounts.player)?;
    slot.profession = chosen;
    slot.flags = WANDERER;
    Ok(())
}

/// Recruiting costs a 15-Glint gift; the wanderer then stays.
pub fn recruit(ctx: Context<Recruit>, slot: u8) -> Result<()> {
    let index = index(slot, crate::state::VILLAGER_SLOTS)?;
    let village = &mut *ctx.accounts.village.load_mut()?;
    let villager = &mut village.villagers[index];
    if villager.flags & WANDERER == 0 {
        return err!(GameError::NotReady);
    }
    ctx.accounts.purse.glints = ctx
        .accounts
        .purse
        .glints
        .checked_sub(1_500)
        .ok_or(error!(GameError::BadAmount))?;
    villager.flags &= !WANDERER;
    villager.joined_at = now()?;
    Ok(())
}

/// Villager output since the last settle, at the old warmth, into the
/// stockpile; capped at 8 hours. Food comes out of the stockpile first.
fn settle(village: &mut Village, now: i64) -> Result<()> {
    if village.last_collect == 0 {
        village.last_collect = now;
        return Ok(());
    }
    let hours_x100 = (now.saturating_sub(village.last_collect).max(0) * 100 / 3_600).min(800);
    let bonus = warmth_bonus_bp(village.warmth_x100);
    let workers: Vec<(u8, bool)> = village
        .villagers
        .iter()
        .filter(|villager| villager.id != 0 && villager.flags & WANDERER == 0)
        .map(|villager| (villager.profession, villager.flags & BOUND != 0))
        .collect();
    let upkeep = workers.len() as u32 * u32::try_from(hours_x100 / 200).unwrap_or(0);
    let food = village.stockpile[3];
    let fed = food >= upkeep;
    if fed {
        village.stockpile[3] = food - upkeep;
    }
    if !fed {
        return Ok(());
    }
    for (profession, _bound) in workers {
        let rate_per_hour = match profession {
            crate::logic::ids::PROF_WOODCUTTER => (3u32, 0u32, 0u32, 0u32),
            crate::logic::ids::PROF_MINER => (0, 2, 0, 0),
            crate::logic::ids::PROF_FARMER => (0, 0, 0, 4),
            _ => (0, 0, 0, 0),
        };
        let scaled = (hours_x100.max(0) as u64) * u64::from(BP + bonus) / u64::from(BP) / 100;
        village.stockpile[0] = village.stockpile[0]
            .saturating_add(rate_per_hour.0.saturating_mul(scaled as u32))
            .min(10_000);
        village.stockpile[1] = village.stockpile[1]
            .saturating_add(rate_per_hour.1.saturating_mul(scaled as u32))
            .min(10_000);
        village.stockpile[3] = village.stockpile[3]
            .saturating_add(rate_per_hour.3.saturating_mul(scaled as u32))
            .min(10_000);
    }
    village.last_collect = now;
    Ok(())
}

fn warmth_of(village: &Village) -> u16 {
    let mut total = 0u32;
    for post in village.posts.iter() {
        if post.flags & HAS_BLOCK == 0 {
            continue;
        }
        if let Ok(warmth) = block_warmth(post.grade, post.purity_bp) {
            total = total.saturating_add(u32::from(warmth));
        }
    }
    u16::try_from(total).unwrap_or(u16::MAX)
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

fn index(slot: u8, capacity: usize) -> Result<usize> {
    let index = usize::from(slot);
    if index >= capacity {
        return err!(GameError::BadAmount);
    }
    Ok(index)
}

#[derive(Accounts, Session)]
pub struct PlaceGem<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [VILLAGE_SEED, player.owner.as_ref()], bump)]
    pub village: AccountLoader<'info, Village>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts, Session)]
pub struct TakeGem<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [VILLAGE_SEED, player.owner.as_ref()], bump)]
    pub village: AccountLoader<'info, Village>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts, Session)]
pub struct Collect<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [VILLAGE_SEED, player.owner.as_ref()], bump)]
    pub village: AccountLoader<'info, Village>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts, Session)]
pub struct Feed<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [VILLAGE_SEED, player.owner.as_ref()], bump)]
    pub village: AccountLoader<'info, Village>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[vrf]
#[derive(Accounts, Session)]
pub struct RingBell<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [VILLAGE_SEED, player.owner.as_ref()], bump)]
    pub village: AccountLoader<'info, Village>,
    #[account(seeds = [crate::state::SEASON_SEED], bump)]
    pub season: AccountLoader<'info, crate::state::Season>,
    /// CHECK: The VRF queue. The VRF program checks it.
    #[account(mut)]
    pub oracle_queue: UncheckedAccount<'info>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct BellCb<'info> {
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [VILLAGE_SEED, player.owner.as_ref()], bump)]
    pub village: AccountLoader<'info, Village>,
}

#[derive(Accounts, Session)]
pub struct Recruit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [VILLAGE_SEED, player.owner.as_ref()], bump)]
    pub village: AccountLoader<'info, Village>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
