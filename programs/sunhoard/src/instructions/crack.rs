//! Two-step thaw. `crack` charges the fee. `crack_reveal` runs in a later slot.

use anchor_lang::prelude::*;
use session_keys::{Session, SessionTokenV2};

use super::mint::next_item_id;
use super::stack::{find_empty, recount};
use crate::errors::{GameError, LogicError};
use crate::logic::{commitment, reveal_shell, seal_key, thaw_fee, Gem};
use crate::state::{
    Inventory, ItemSlot, Player, Purse, Season, World, CRACKING, INVENTORY_SEED, LISTED,
    PLAYER_SEED, PURSE_SEED, SEALED, SEASON_SEED, WORLD_SEED,
};

pub fn crack(ctx: Context<Crack>, slot: u8) -> Result<()> {
    let index = index(slot)?;
    let fee = fee_of(&*ctx.accounts.inventory.load()?, index)?;
    burn(
        &mut ctx.accounts.purse,
        &mut *ctx.accounts.season.load_mut()?,
        fee,
    )?;
    let opened = Clock::get()?.slot;
    let mut inventory = ctx.accounts.inventory.load_mut()?;
    let item = &mut inventory.slots[index];
    item.flags |= CRACKING;
    item.cracking_since = opened;
    Ok(())
}

pub fn reveal(mut ctx: Context<CrackReveal>, slot: u8) -> Result<()> {
    let index = index(slot)?;
    let opened = read_ready(&ctx, index)?;
    if opened.dust > 0 {
        return pay_dust(&mut ctx, index, opened.dust);
    }
    let second = second_id(&mut ctx, opened.gems[1].is_some())?;
    write_opened(&mut ctx, index, opened, second)
}

fn fee_of(inventory: &Inventory, index: usize) -> Result<u64> {
    let item = &inventory.slots[index];
    if item.flags & SEALED == 0
        || item.flags & CRACKING != 0
        || item.flags & LISTED != 0
        || item.commitment == [0; 32]
    {
        return err!(GameError::NotReady);
    }
    thaw_fee(item.shell_size).map_err(rule)
}

fn burn(purse: &mut Purse, season: &mut Season, fee: u64) -> Result<()> {
    purse.glints = purse
        .glints
        .checked_sub(fee)
        .ok_or(error!(GameError::BadAmount))?;
    season.burned = season
        .burned
        .checked_add(fee)
        .ok_or(error!(GameError::NotReady))?;
    Ok(())
}

fn read_ready(ctx: &Context<CrackReveal>, index: usize) -> Result<Opened> {
    let item = &ctx.accounts.inventory.load()?.slots[index];
    if item.flags & SEALED == 0
        || item.flags & CRACKING == 0
        || item.flags & LISTED != 0
        || item.commitment == [0; 32]
    {
        return err!(GameError::NotReady);
    }
    if Clock::get()?.slot <= item.cracking_since {
        return err!(GameError::NotReady);
    }
    let salt = salt_for(&ctx.accounts.world, item.salt_epoch)?;
    let key = seal_key(&salt, item.id);
    if commitment(&key) != item.commitment {
        return err!(GameError::BadAccount);
    }
    let revealed = reveal_shell(&key, item.shell_size).map_err(rule)?;
    Ok(Opened {
        key,
        shell: item.shell_size,
        dust: revealed.dust_hundredths,
        gems: revealed.gems,
    })
}

fn second_id(ctx: &mut Context<CrackReveal>, needed: bool) -> Result<Option<u64>> {
    if !needed {
        return Ok(None);
    }
    if find_empty(&*ctx.accounts.inventory.load()?).is_none() {
        return err!(GameError::Full);
    }
    Ok(Some(next_item_id(&mut ctx.accounts.player)?))
}

fn write_opened(
    ctx: &mut Context<CrackReveal>,
    index: usize,
    opened: Opened,
    second_id: Option<u64>,
) -> Result<()> {
    let mut inventory = ctx.accounts.inventory.load_mut()?;
    let shell = opened.shell;
    let key = opened.key;
    let id = inventory.slots[index].id;
    let gem = opened.gems[0].ok_or(error!(GameError::NotReady))?;
    write_gem(&mut inventory.slots[index], id, key, gem, shell);
    if let Some(id) = second_id {
        let empty = find_empty(&inventory).ok_or(error!(GameError::Full))?;
        write_gem(
            &mut inventory.slots[empty],
            id,
            key,
            opened.gems[1].ok_or(error!(GameError::NotReady))?,
            shell,
        );
    }
    recount(&mut inventory);
    Ok(())
}

fn pay_dust(ctx: &mut Context<CrackReveal>, index: usize, dust: u64) -> Result<()> {
    ctx.accounts.purse.glints = ctx
        .accounts
        .purse
        .glints
        .checked_add(dust)
        .ok_or(error!(GameError::NotReady))?;
    let mut inventory = ctx.accounts.inventory.load_mut()?;
    clear(&mut inventory.slots[index]);
    recount(&mut inventory);
    Ok(())
}

fn write_gem(slot: &mut ItemSlot, id: u64, key: [u8; 32], gem: Gem, shell: u8) {
    slot.id = id;
    slot.commitment = commitment(&key);
    slot.revealed_key = key;
    slot.cracking_since = 0;
    slot.quantity = 1;
    slot.purity_bp = gem.purity_bp;
    slot.pattern = gem.pattern;
    slot.shell_size = shell;
    slot.tone = gem.tone;
    slot.grade = gem.grade;
    slot.flags &= !(SEALED | CRACKING);
}

fn clear(slot: &mut ItemSlot) {
    slot.id = 0;
    slot.commitment = [0; 32];
    slot.revealed_key = [0; 32];
    slot.cracking_since = 0;
    slot.kind = 0;
    slot.quantity = 0;
    slot.purity_bp = 0;
    slot.pattern = 0;
    slot.traits = [crate::state::TraitPair { id: 0, tier: 0 }; 4];
    slot.salt_epoch = 0;
    slot.shell_size = 0;
    slot.tone = 0;
    slot.grade = 0;
    slot.rarity = 0;
    slot.flags = 0;
}

fn salt_for(world: &World, epoch: u8) -> Result<[u8; 32]> {
    world
        .salts
        .get(usize::from(epoch))
        .copied()
        .ok_or(error!(GameError::NotReady))
}

fn index(slot: u8) -> Result<usize> {
    let index = usize::from(slot);
    if index >= crate::state::INVENTORY_SLOTS {
        return err!(GameError::BadAmount);
    }
    Ok(index)
}

fn rule(err: LogicError) -> Error {
    match err {
        LogicError::BadShell => error!(GameError::BadAmount),
        _ => error!(GameError::NotReady),
    }
}

struct Opened {
    key: [u8; 32],
    shell: u8,
    dust: u64,
    gems: [Option<Gem>; 2],
}

#[derive(Accounts, Session)]
pub struct Crack<'info> {
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
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts, Session)]
pub struct CrackReveal<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[account(seeds = [WORLD_SEED], bump)]
    pub world: Account<'info, World>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
