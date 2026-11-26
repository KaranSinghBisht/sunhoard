//! The Coldfair: fixed-price listings with a 1-Glint deposit and the 5% Hearth
//! Penny. Buying is atomic: both purses, the item and the fee split move in one
//! instruction.

use anchor_lang::prelude::*;
use session_keys::{Session, SessionTokenV2};

use super::anvil::on_the_anvil;
use super::stack::{clear_slot, find_empty, recount, unequip};
use crate::errors::GameError;
use crate::logic::market::{
    fee_split, seller_receives, FeeSplit, LISTING_DEPOSIT_HUNDREDTHS, LISTINGS_PER_PLAYER,
    LISTING_TTL_SECS,
};
use crate::logic::world::first_light;
use crate::state::{
    Inventory, ItemSlot, ListedItem, Listing, Market, Player, Purse, Season, BOUND, CRACKING,
    DEMO_MODE, FORGING, INVENTORY_SEED, LISTED, MARKET_SEED, PLAYER_SEED, PURSE_SEED,
    SEASON_SEED,
};

pub fn list(ctx: Context<List>, slot: u8, price: u64) -> Result<()> {
    let index = index(slot, crate::state::INVENTORY_SLOTS)?;
    let now = Clock::get()?.unix_timestamp;
    let seller = ctx.accounts.player.owner;
    {
        let inventory = ctx.accounts.inventory.load()?;
        let item = &inventory.slots[index];
        if item.flags & (BOUND | LISTED | CRACKING) != 0
            || on_the_anvil(item, index, &ctx.accounts.player, now)
            || is_empty(item)
        {
            return err!(GameError::BadAmount);
        }
        if price == 0 {
            return err!(GameError::BadAmount);
        }
    }
    let market = &mut *ctx.accounts.market.load_mut()?;
    if seller_count(market, &seller) >= LISTINGS_PER_PLAYER {
        return err!(GameError::NotReady);
    }
    let listing_index = find_open_listing(market).ok_or(error!(GameError::NotReady))?;
    pay_deposit(&mut ctx.accounts.purse, &mut *ctx.accounts.season.load_mut()?)?;
    {
        let inventory = &mut *ctx.accounts.inventory.load_mut()?;
        let item = &inventory.slots[index];
        market.listings[listing_index] = Listing {
            seller,
            price,
            revision: market.listings[listing_index].revision.checked_add(1).ok_or(error!(GameError::NotReady))?,
            expires_at: now.checked_add(LISTING_TTL_SECS).ok_or(error!(GameError::NotReady))?,
            item: to_listed(item),
        };
        clear_slot(&mut inventory.slots[index]);
        recount(inventory);
    }
    market.count = market.count.saturating_add(1);
    unequip(&mut ctx.accounts.player, index);
    Ok(())
}

pub fn cancel(ctx: Context<Cancel>, listing: u8, revision: u64) -> Result<()> {
    let listing_index = index(listing, crate::state::LISTING_SLOTS)?;
    let owner = ctx.accounts.player.owner;
    let market = &mut *ctx.accounts.market.load_mut()?;
    let found = &market.listings[listing_index];
    if !open(found) || found.seller != owner {
        return err!(GameError::BadAccount);
    }
    require_eq!(found.revision, revision, GameError::ChangedListing);
    let item = found.item;
    let inventory = &mut *ctx.accounts.inventory.load_mut()?;
    let slot = find_empty(inventory).ok_or(error!(GameError::Full))?;
    inventory.slots[slot] = from_listed(item);
    market.listings[listing_index] = Listing { revision, ..Listing::default() };
    market.count = market.count.saturating_sub(1);
    recount(inventory);
    Ok(())
}

pub fn buy(ctx: Context<Buy>, listing: u8, revision: u64, expected_price: u64) -> Result<()> {
    let listing_index = index(listing, crate::state::LISTING_SLOTS)?;
    let buyer = ctx.accounts.player.owner;
    let (seller, price, item) = {
        let market = ctx.accounts.market.load()?;
        let found = &market.listings[listing_index];
        validate_quote(found, revision, expected_price, Clock::get()?.unix_timestamp)?;
        if found.seller == buyer {
            return err!(GameError::BadAmount);
        }
        (found.seller, found.price, found.item)
    };
    // The seller purse must be the listing seller's PDA, checked by hand.
    let (expected, _) = Pubkey::find_program_address(&[PURSE_SEED, seller.as_ref()], &crate::ID);
    if ctx.accounts.seller_purse.key() != expected {
        return err!(GameError::BadAccount);
    }
    let split = penny(&*ctx.accounts.season.load()?, price)?;
    let seller_gets = seller_receives(price, split.fee)
        .map_err(|_| error!(GameError::BadAmount))?
        .checked_add(LISTING_DEPOSIT_HUNDREDTHS)
        .ok_or(error!(GameError::NotReady))?;
    // The buyer's pack must have room before anything moves.
    if find_empty(&*ctx.accounts.inventory.load()?).is_none() {
        return err!(GameError::Full);
    }
    let purse = &mut ctx.accounts.purse;
    purse.glints = purse
        .glints
        .checked_sub(price)
        .ok_or(error!(GameError::BadAmount))?;
    credit(&ctx.accounts.seller_purse, seller_gets)?;
    let season = &mut *ctx.accounts.season.load_mut()?;
    season.pot = season
        .pot
        .checked_add(split.pot)
        .ok_or(error!(GameError::NotReady))?;
    // The listing deposit was counted as burned when it was paid. A sale
    // hands it back to the seller, so it leaves the burned total again.
    season.burned = season
        .burned
        .saturating_sub(LISTING_DEPOSIT_HUNDREDTHS)
        .checked_add(split.burned)
        .ok_or(error!(GameError::NotReady))?;
    let inventory = &mut *ctx.accounts.inventory.load_mut()?;
    let slot = find_empty(inventory).ok_or(error!(GameError::Full))?;
    inventory.slots[slot] = from_listed(item);
    recount(inventory);
    let market = &mut *ctx.accounts.market.load_mut()?;
    market.listings[listing_index] = Listing { revision, ..Listing::default() };
    market.count = market.count.saturating_sub(1);
    Ok(())
}

fn validate_quote(listing: &Listing, revision: u64, price: u64, now: i64) -> Result<()> {
    require!(open(listing) && listing.revision == revision && listing.price == price
        && now < listing.expires_at, GameError::ChangedListing);
    Ok(())
}

/// The Hearth Penny on this sale. First Light, the first stretch of Spring,
/// takes none.
fn penny(season: &Season, price: u64) -> Result<FeeSplit> {
    let now = Clock::get()?.unix_timestamp;
    let demo = season.flags & DEMO_MODE != 0;
    if first_light(season.phase, season.phase_started, demo, now) {
        return Ok(FeeSplit {
            fee: 0,
            pot: 0,
            burned: 0,
        });
    }
    fee_split(price).map_err(|_| error!(GameError::BadAmount))
}

/// Credits the seller's purse without a typed Account: the seeds were checked.
fn credit(seller_purse: &AccountInfo, amount: u64) -> Result<()> {
    let mut data = seller_purse.try_borrow_mut_data()?;
    let at = 8 + core::mem::offset_of!(Purse, glints);
    if at + 8 > data.len() {
        return err!(GameError::BadAccount);
    }
    let current = u64::from_le_bytes(data[at..at + 8].try_into().expect("slice"));
    let next = current.checked_add(amount).ok_or(error!(GameError::NotReady))?;
    data[at..at + 8].copy_from_slice(&next.to_le_bytes());
    Ok(())
}

fn pay_deposit(purse: &mut Purse, season: &mut Season) -> Result<()> {
    purse.glints = purse
        .glints
        .checked_sub(LISTING_DEPOSIT_HUNDREDTHS)
        .ok_or(error!(GameError::BadAmount))?;
    season.burned = season
        .burned
        .checked_add(LISTING_DEPOSIT_HUNDREDTHS)
        .ok_or(error!(GameError::NotReady))?;
    Ok(())
}

fn seller_count(market: &Market, seller: &Pubkey) -> u8 {
    market
        .listings
        .iter()
        .filter(|listing| open(listing) && listing.seller == *seller)
        .count() as u8
}

fn find_open_listing(market: &Market) -> Option<usize> {
    market.listings.iter().position(|listing| !open(listing))
}

/// A listing slot is in use when its item holds anything: an id, a kind, a
/// stack, or a flag. Material stacks legitimately have id 0.
fn open(listing: &Listing) -> bool {
    listing.item.id != 0
        || listing.item.kind != 0
        || listing.item.quantity != 0
        || listing.item.flags != 0
}

fn is_empty(item: &ItemSlot) -> bool {
    item.id == 0 && item.kind == 0 && item.quantity == 0 && item.flags == 0
}

fn to_listed(item: &ItemSlot) -> ListedItem {
    ListedItem {
        id: item.id,
        commitment: item.commitment,
        revealed_key: item.revealed_key,
        kind: item.kind,
        quantity: item.quantity,
        purity_bp: item.purity_bp,
        pattern: item.pattern,
        traits: item.traits,
        salt_epoch: item.salt_epoch,
        shell_size: item.shell_size,
        tone: item.tone,
        grade: item.grade,
        rarity: item.rarity,
        // A lost strike's mark does not follow the item to the next owner.
        flags: (item.flags & !FORGING) | LISTED,
        _pad: [0; 2],
    }
}

fn from_listed(item: ListedItem) -> ItemSlot {
    ItemSlot {
        id: item.id,
        commitment: item.commitment,
        revealed_key: item.revealed_key,
        cracking_since: 0,
        kind: item.kind,
        quantity: item.quantity,
        purity_bp: item.purity_bp,
        pattern: item.pattern,
        traits: item.traits,
        salt_epoch: item.salt_epoch,
        shell_size: item.shell_size,
        tone: item.tone,
        grade: item.grade,
        rarity: item.rarity,
        flags: item.flags & !LISTED,
        _pad: [0; 2],
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
pub struct List<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    #[account(mut, seeds = [MARKET_SEED], bump)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts, Session)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [MARKET_SEED], bump)]
    pub market: AccountLoader<'info, Market>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts, Session)]
pub struct Buy<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, player.owner.as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [INVENTORY_SEED, player.owner.as_ref()], bump)]
    pub inventory: AccountLoader<'info, Inventory>,
    #[account(mut, seeds = [PURSE_SEED, player.owner.as_ref()], bump)]
    pub purse: Account<'info, Purse>,
    /// CHECK: The handler checks it is the listing seller's purse PDA.
    #[account(mut)]
    pub seller_purse: UncheckedAccount<'info>,
    #[account(mut, seeds = [MARKET_SEED], bump)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut, seeds = [SEASON_SEED], bump)]
    pub season: AccountLoader<'info, Season>,
    #[session(signer = payer, authority = player.owner)]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

impl Listing {
    pub fn default() -> Self {
        Self {
            seller: Pubkey::default(),
            price: 0,
            revision: 0,
            expires_at: 0,
            item: ListedItem {
                id: 0,
                commitment: [0; 32],
                revealed_key: [0; 32],
                kind: 0,
                quantity: 0,
                purity_bp: 0,
                pattern: 0,
                traits: [crate::state::TraitPair { id: 0, tier: 0 }; 4],
                salt_epoch: 0,
                shell_size: 0,
                tone: 0,
                grade: 0,
                rarity: 0,
                flags: 0,
                _pad: [0; 2],
            },
        }
    }
}
