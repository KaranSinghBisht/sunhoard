//! Auntie Pell: selling at the Charter price and buying from her shop.

use anchor_lang::prelude::*;
use session_keys::{Session, SessionTokenV2};

use super::anvil::on_the_anvil;
use super::mint;
use super::stack::{add_kind, clear_slot, recount, unequip};
use crate::errors::GameError;
use crate::logic::ids::{gear_material, is_gear_kind};
use crate::logic::merchant::{sell_block, sell_gear, sell_material, sell_shell, shop_price};
use crate::state::{
    Inventory, Player, PriceBoard, Purse, BOUND, CRACKING, INVENTORY_SEED, LISTED,
    PLAYER_SEED, PRICES_SEED, PURSE_SEED, SEALED,
};

pub fn sell(ctx: Context<MerchantSell>, slot: u8) -> Result<()> {
    let index = index(slot)?;
    let now = Clock::get()?.unix_timestamp;
    let price = {
        let inventory = ctx.accounts.inventory.load()?;
        let item = &inventory.slots[index];
        if item.flags & (BOUND | LISTED | CRACKING) != 0
            || on_the_anvil(item, index, &ctx.accounts.player, now)
        {
            return err!(GameError::BadAmount);
        }
        let wanted = wants(&ctx.accounts.prices, item.kind);
        price_of(item, wanted)?
    };
    ctx.accounts.purse.glints = ctx
        .accounts
        .purse
        .glints
        .checked_add(price)
        .ok_or(error!(GameError::NotReady))?;
    let inventory = &mut *ctx.accounts.inventory.load_mut()?;
    clear_slot(&mut inventory.slots[index]);
    recount(inventory);
    unequip(&mut ctx.accounts.player, index);
    Ok(())
}

pub fn buy(ctx: Context<MerchantBuy>, good: u16) -> Result<()> {
    let price = shop_price(good).map_err(|_| error!(GameError::BadAmount))?;
    pay(&mut ctx.accounts.purse, price)?;
    if is_gear_kind(good) {
        mint::gear(
            &mut ctx.accounts.player,
            &mut *ctx.accounts.inventory.load_mut()?,
            good,
            crate::logic::ids::RARITY_COMMON,
        )?;
    } else {
        add_kind(&mut *ctx.accounts.inventory.load_mut()?, good, 1)?;
    }
    Ok(())
}

fn pay(purse: &mut Purse, price: u64) -> Result<()> {
    purse.glints = purse
        .glints
        .checked_sub(price)
        .ok_or(error!(GameError::BadAmount))?;
    Ok(())
}

/// What Pell pays for this slot: a sealed shell, gear, a revealed block, or a stack.
fn price_of(item: &crate::state::ItemSlot, wanted: bool) -> Result<u64> {
    if item.flags & SEALED != 0 {
        return sell_shell(item.shell_size, wanted).map_err(|_| error!(GameError::BadAmount));
    }
    if is_gear_kind(item.kind) {
        return sell_gear(gear_material(item.kind), item.rarity, wanted)
            .map_err(|_| error!(GameError::BadAmount));
    }
    if item.id != 0 && item.kind == 0 {
        return sell_block(item.grade, item.purity_bp, wanted)
            .map_err(|_| error!(GameError::BadAmount));
    }
    if item.id != 0 || item.quantity == 0 {
        return err!(GameError::BadAmount);
    }
    // The sale clears the whole stack, so Pell pays for every unit in it.
    sell_material(item.kind, wanted)
        .map_err(|_| error!(GameError::BadAmount))?
        .checked_mul(u64::from(item.quantity))
        .ok_or(error!(GameError::NotReady))
}

/// Pell's Wants: two goods at +50% while the board's clock holds.
fn wants(prices: &PriceBoard, kind: u16) -> bool {
    if kind == 0 {
        return false;
    }
    let now = Clock::get().map(|clock| clock.unix_timestamp).unwrap_or(0);
    now < prices.until && (prices.good_a == kind || prices.good_b == kind)
}

fn index(slot: u8) -> Result<usize> {
    let index = usize::from(slot);
    if index >= crate::state::INVENTORY_SLOTS {
        return err!(GameError::BadAmount);
    }
    Ok(index)
}

#[derive(Accounts, Session)]
pub struct MerchantSell<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[account(seeds = [PRICES_SEED], bump)]
    pub prices: Account<'info, PriceBoard>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts, Session)]
pub struct MerchantBuy<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}
