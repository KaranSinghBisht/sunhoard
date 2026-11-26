//! Sunhoard program. `logic` is pure Rust. Instructions call it.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod logic;
mod sdk;
pub mod state;

declare_id!("FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS");

// The program macro generates handlers at the crate root. The Accounts derive
// emits its helper modules next to the struct, so both are re-exported here.
pub(crate) use instructions::anvil::__client_accounts_strike;
pub(crate) use instructions::anvil::__client_accounts_strike_cb;
#[cfg(feature = "cpi")]
pub(crate) use instructions::anvil::__cpi_client_accounts_strike;
#[cfg(feature = "cpi")]
pub(crate) use instructions::anvil::__cpi_client_accounts_strike_cb;
pub use instructions::anvil::{Strike, StrikeCb};
pub(crate) use instructions::crack::__client_accounts_crack;
pub(crate) use instructions::crack::__client_accounts_crack_reveal;
#[cfg(feature = "cpi")]
pub(crate) use instructions::crack::__cpi_client_accounts_crack;
#[cfg(feature = "cpi")]
pub(crate) use instructions::crack::__cpi_client_accounts_crack_reveal;
pub use instructions::crack::{Crack, CrackReveal};
pub(crate) use instructions::craft::__client_accounts_craft;
pub(crate) use instructions::craft::__client_accounts_craft_cb;
#[cfg(feature = "cpi")]
pub(crate) use instructions::craft::__cpi_client_accounts_craft;
#[cfg(feature = "cpi")]
pub(crate) use instructions::craft::__cpi_client_accounts_craft_cb;
pub use instructions::craft::{Craft, CraftCb};
#[cfg(feature = "debug")]
pub use instructions::debug::DebugGrant;
#[cfg(feature = "debug")]
pub(crate) use instructions::debug::__client_accounts_debug_grant;
#[cfg(all(feature = "debug", feature = "cpi"))]
pub(crate) use instructions::debug::__cpi_client_accounts_debug_grant;
pub(crate) use instructions::delegate_player::__client_accounts_delegate_home;
pub(crate) use instructions::delegate_player::__client_accounts_delegate_player;
#[cfg(feature = "cpi")]
pub(crate) use instructions::delegate_player::__cpi_client_accounts_delegate_home;
#[cfg(feature = "cpi")]
pub(crate) use instructions::delegate_player::__cpi_client_accounts_delegate_player;
pub use instructions::delegate_player::{DelegateHome, DelegatePlayer};
pub use instructions::delegate_shared::DelegateShared;
pub(crate) use instructions::delegate_shared::__client_accounts_delegate_shared;
#[cfg(feature = "cpi")]
pub(crate) use instructions::delegate_shared::__cpi_client_accounts_delegate_shared;
pub(crate) use instructions::demo::__client_accounts_demo_grant;
pub(crate) use instructions::demo::__client_accounts_set_demo_mode;
#[cfg(feature = "cpi")]
pub(crate) use instructions::demo::__cpi_client_accounts_demo_grant;
#[cfg(feature = "cpi")]
pub(crate) use instructions::demo::__cpi_client_accounts_set_demo_mode;
pub use instructions::demo::{DemoGrant, SetDemoMode};
pub(crate) use instructions::dungeon::__client_accounts_chest_cb;
pub(crate) use instructions::dungeon::__client_accounts_dungeon_cb;
pub(crate) use instructions::dungeon::__client_accounts_enter_dungeon;
pub(crate) use instructions::dungeon::__client_accounts_next_room;
#[cfg(feature = "cpi")]
pub(crate) use instructions::dungeon::__cpi_client_accounts_chest_cb;
#[cfg(feature = "cpi")]
pub(crate) use instructions::dungeon::__cpi_client_accounts_dungeon_cb;
#[cfg(feature = "cpi")]
pub(crate) use instructions::dungeon::__cpi_client_accounts_enter_dungeon;
#[cfg(feature = "cpi")]
pub(crate) use instructions::dungeon::__cpi_client_accounts_next_room;
pub use instructions::dungeon::{ChestCb, DungeonCb, EnterDungeon, NextRoom};
pub(crate) use instructions::eat::__client_accounts_eat;
#[cfg(feature = "cpi")]
pub(crate) use instructions::eat::__cpi_client_accounts_eat;
pub use instructions::eat::Eat;
pub(crate) use instructions::equip::__client_accounts_equip;
#[cfg(feature = "cpi")]
pub(crate) use instructions::equip::__cpi_client_accounts_equip;
pub use instructions::equip::Equip;
pub use instructions::exit::ExitDungeon;
pub(crate) use instructions::exit::__client_accounts_exit_dungeon;
#[cfg(feature = "cpi")]
pub(crate) use instructions::exit::__cpi_client_accounts_exit_dungeon;
pub(crate) use instructions::gather::__client_accounts_gather;
pub(crate) use instructions::gather::__client_accounts_gather_cb;
#[cfg(feature = "cpi")]
pub(crate) use instructions::gather::__cpi_client_accounts_gather;
#[cfg(feature = "cpi")]
pub(crate) use instructions::gather::__cpi_client_accounts_gather_cb;
pub use instructions::gather::{Gather, GatherCb};
pub use instructions::init_game::InitGame;
pub(crate) use instructions::init_game::__client_accounts_init_game;
#[cfg(feature = "cpi")]
pub(crate) use instructions::init_game::__cpi_client_accounts_init_game;
pub use instructions::init_payout::InitPayout;
pub(crate) use instructions::init_payout::__client_accounts_init_payout;
#[cfg(feature = "cpi")]
pub(crate) use instructions::init_payout::__cpi_client_accounts_init_payout;
pub use instructions::input::ArenaInput;
pub(crate) use instructions::input::__client_accounts_arena_input;
#[cfg(feature = "cpi")]
pub(crate) use instructions::input::__cpi_client_accounts_arena_input;
pub use instructions::join::Join;
pub(crate) use instructions::join::__client_accounts_join;
#[cfg(feature = "cpi")]
pub(crate) use instructions::join::__cpi_client_accounts_join;
pub(crate) use instructions::lair::__client_accounts_catch_spark;
pub(crate) use instructions::lair::__client_accounts_enter_lair;
pub(crate) use instructions::lair::__client_accounts_exit_lair;
pub(crate) use instructions::lair::__client_accounts_lair_cb;
pub(crate) use instructions::lair::__client_accounts_lair_input;
pub(crate) use instructions::lair::__client_accounts_tick_lair;
#[cfg(feature = "cpi")]
pub(crate) use instructions::lair::__cpi_client_accounts_catch_spark;
#[cfg(feature = "cpi")]
pub(crate) use instructions::lair::__cpi_client_accounts_enter_lair;
#[cfg(feature = "cpi")]
pub(crate) use instructions::lair::__cpi_client_accounts_exit_lair;
#[cfg(feature = "cpi")]
pub(crate) use instructions::lair::__cpi_client_accounts_lair_cb;
#[cfg(feature = "cpi")]
pub(crate) use instructions::lair::__cpi_client_accounts_lair_input;
#[cfg(feature = "cpi")]
pub(crate) use instructions::lair::__cpi_client_accounts_tick_lair;
pub use instructions::lair::{CatchSpark, EnterLair, ExitLair, LairCb, LairInput, TickLair};
#[cfg(feature = "debug")]
pub use instructions::kill::DebugKill;
#[cfg(feature = "debug")]
pub(crate) use instructions::kill::__client_accounts_debug_kill;
#[cfg(all(feature = "debug", feature = "cpi"))]
pub(crate) use instructions::kill::__cpi_client_accounts_debug_kill;
pub(crate) use instructions::market::__client_accounts_buy;
pub(crate) use instructions::market::__client_accounts_cancel;
pub(crate) use instructions::market::__client_accounts_list;
#[cfg(feature = "cpi")]
pub(crate) use instructions::market::__cpi_client_accounts_buy;
#[cfg(feature = "cpi")]
pub(crate) use instructions::market::__cpi_client_accounts_cancel;
#[cfg(feature = "cpi")]
pub(crate) use instructions::market::__cpi_client_accounts_list;
pub use instructions::market::{Buy, Cancel, List};
pub(crate) use instructions::merchant::__client_accounts_merchant_buy;
pub(crate) use instructions::merchant::__client_accounts_merchant_sell;
#[cfg(feature = "cpi")]
pub(crate) use instructions::merchant::__cpi_client_accounts_merchant_buy;
#[cfg(feature = "cpi")]
pub(crate) use instructions::merchant::__cpi_client_accounts_merchant_sell;
pub use instructions::merchant::{MerchantBuy, MerchantSell};
pub use instructions::permissions::SetPermissionsShared;
pub(crate) use instructions::permissions::__client_accounts_set_permissions_shared;
#[cfg(feature = "cpi")]
pub(crate) use instructions::permissions::__cpi_client_accounts_set_permissions_shared;
pub use instructions::position::PostPosition;
pub(crate) use instructions::position::__client_accounts_post_position;
#[cfg(feature = "cpi")]
pub(crate) use instructions::position::__cpi_client_accounts_post_position;
pub use instructions::awards::ClaimGlints;
pub(crate) use instructions::awards::__client_accounts_claim_glints;
#[cfg(feature = "cpi")]
pub(crate) use instructions::awards::__cpi_client_accounts_claim_glints;
pub(crate) use instructions::record::__client_accounts_claim;
pub(crate) use instructions::record::__client_accounts_record_payout;
#[cfg(feature = "cpi")]
pub(crate) use instructions::record::__cpi_client_accounts_claim;
#[cfg(feature = "cpi")]
pub(crate) use instructions::record::__cpi_client_accounts_record_payout;
pub use instructions::record::{Claim, RecordPayout};
pub(crate) use instructions::season::__client_accounts_name_wyrm;
pub(crate) use instructions::season::__client_accounts_salt_cb;
pub(crate) use instructions::season::__client_accounts_start_season;
#[cfg(feature = "cpi")]
pub(crate) use instructions::season::__cpi_client_accounts_name_wyrm;
#[cfg(feature = "cpi")]
pub(crate) use instructions::season::__cpi_client_accounts_salt_cb;
#[cfg(feature = "cpi")]
pub(crate) use instructions::season::__cpi_client_accounts_start_season;
pub use instructions::season::{NameWyrm, SaltCb, StartSeason};
pub use instructions::settle::SettleSeason;
pub(crate) use instructions::settle::__client_accounts_settle_season;
#[cfg(feature = "cpi")]
pub(crate) use instructions::settle::__cpi_client_accounts_settle_season;
pub use instructions::signup::SignUp;
pub(crate) use instructions::signup::__client_accounts_sign_up;
#[cfg(feature = "cpi")]
pub(crate) use instructions::signup::__cpi_client_accounts_sign_up;
pub use instructions::tick::TickArena;
pub(crate) use instructions::tick::__client_accounts_tick_arena;
#[cfg(feature = "cpi")]
pub(crate) use instructions::tick::__cpi_client_accounts_tick_arena;
pub(crate) use instructions::village::__client_accounts_bell_cb;
pub(crate) use instructions::village::__client_accounts_collect;
pub(crate) use instructions::village::__client_accounts_feed;
pub(crate) use instructions::village::__client_accounts_place_gem;
pub(crate) use instructions::village::__client_accounts_recruit;
pub(crate) use instructions::village::__client_accounts_ring_bell;
pub(crate) use instructions::village::__client_accounts_take_gem;
#[cfg(feature = "cpi")]
pub(crate) use instructions::village::__cpi_client_accounts_bell_cb;
#[cfg(feature = "cpi")]
pub(crate) use instructions::village::__cpi_client_accounts_collect;
#[cfg(feature = "cpi")]
pub(crate) use instructions::village::__cpi_client_accounts_feed;
#[cfg(feature = "cpi")]
pub(crate) use instructions::village::__cpi_client_accounts_place_gem;
#[cfg(feature = "cpi")]
pub(crate) use instructions::village::__cpi_client_accounts_recruit;
#[cfg(feature = "cpi")]
pub(crate) use instructions::village::__cpi_client_accounts_ring_bell;
#[cfg(feature = "cpi")]
pub(crate) use instructions::village::__cpi_client_accounts_take_gem;
pub use instructions::village::{
    BellCb, Collect, Feed, PlaceGem, Recruit, RingBell, TakeGem,
};
pub(crate) use instructions::world::__client_accounts_schedule_world;
pub(crate) use instructions::world::__client_accounts_tick_world;
#[cfg(feature = "cpi")]
pub(crate) use instructions::world::__cpi_client_accounts_schedule_world;
#[cfg(feature = "cpi")]
pub(crate) use instructions::world::__cpi_client_accounts_tick_world;
pub use instructions::world::{ScheduleWorld, TickWorld};

#[ephemeral]
#[program]
pub mod sunhoard {
    use super::*;
    use session_keys::{session_auth_or, SessionError};

    /// Creates Season, World, Market, PriceBoard, Presence and the Vault.
    /// Seeds the Vault, tops up the Magic Action escrow, and prefunds permission rent.
    pub fn init_game(ctx: Context<InitGame>, vault_lamports: u64) -> Result<()> {
        instructions::init_game::handle(ctx, vault_lamports)
    }

    /// Creates the season-1 payout record on Solana. It is never delegated.
    pub fn init_payout(ctx: Context<InitPayout>) -> Result<()> {
        instructions::init_payout::handle(ctx)
    }

    /// Delegates Season, World, Market, PriceBoard and Presence to the given validator.
    pub fn delegate_shared(ctx: Context<DelegateShared>) -> Result<()> {
        instructions::delegate_shared::handle(ctx)
    }

    /// World becomes private with no members. The other shared accounts stay public.
    pub fn set_permissions_shared(ctx: Context<SetPermissionsShared>) -> Result<()> {
        instructions::permissions::handle(ctx)
    }

    /// Asks the VRF for the season salt. The callback opens season 1.
    pub fn start_season(ctx: Context<StartSeason>) -> Result<()> {
        instructions::season::request(ctx, instruction::SaltCb::DISCRIMINATOR.to_vec())
    }

    /// Writes the salt into World. The bytes are not logged.
    pub fn salt_cb(ctx: Context<SaltCb>, randomness: [u8; 32]) -> Result<()> {
        instructions::season::consume(ctx, randomness)
    }

    /// Creates the six player accounts and prefunds Purse and View permission rent.
    pub fn sign_up(ctx: Context<SignUp>) -> Result<()> {
        instructions::signup::handle(ctx)
    }

    /// Delegates Player, Purse and Inventory. Village, Arena and View are the next transaction.
    pub fn delegate_player(ctx: Context<DelegatePlayer>) -> Result<()> {
        instructions::delegate_player::handle_pack(ctx)
    }

    /// Delegates Village, Arena and View.
    pub fn delegate_home(ctx: Context<DelegateHome>) -> Result<()> {
        instructions::delegate_player::handle_home(ctx)
    }

    /// Assigns a player number, gives Nell's bound block, and locks Purse and View.
    pub fn join(ctx: Context<Join>) -> Result<()> {
        instructions::join::handle(ctx)
    }

    /// Writes Player and Presence when the move fits the combat speed.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn post_position(
        ctx: Context<PostPosition>,
        x: u16,
        y: u16,
        zone: u8,
        facing: u8,
    ) -> Result<()> {
        instructions::position::handle(ctx, x, y, zone, facing)
    }

    /// Pays the base yield and asks the VRF for the aberration roll.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn gather(ctx: Context<Gather>, node: u8, node_x: u16, node_y: u16) -> Result<()> {
        instructions::gather::request(
            ctx,
            node,
            node_x,
            node_y,
            instruction::GatherCb::DISCRIMINATOR.to_vec(),
        )
    }

    /// Adds the aberration, or nothing. The roll is not logged.
    pub fn gather_cb(ctx: Context<GatherCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
        instructions::gather::consume(ctx, randomness, nonce)
    }

    /// Charges the thaw fee and marks the shell. The contents stay hidden.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn crack(ctx: Context<Crack>, slot: u8) -> Result<()> {
        instructions::crack::crack(ctx, slot)
    }

    /// Opens a shell that was cracked in an earlier slot. The salt is not logged.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn crack_reveal(ctx: Context<CrackReveal>, slot: u8) -> Result<()> {
        instructions::crack::reveal(ctx, slot)
    }

    /// Gives one sealed Small rimeshell. Absent unless the program is built with `debug`.
    #[cfg(feature = "debug")]
    pub fn debug_grant(ctx: Context<DebugGrant>) -> Result<()> {
        instructions::debug::handle(ctx)
    }

    /// Opens a room, asks the VRF for its seed, and schedules the 100 ms crank.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn enter_dungeon(ctx: Context<EnterDungeon>) -> Result<()> {
        instructions::dungeon::enter(ctx, instruction::DungeonCb::DISCRIMINATOR.to_vec())
    }

    /// Writes the room seed. The bytes are not logged.
    pub fn dungeon_cb(ctx: Context<DungeonCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
        instructions::dungeon::consume(ctx, randomness, nonce)
    }

    /// Stores the move the next tick will use.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn arena_input(
        ctx: Context<ArenaInput>,
        dx: i8,
        dy: i8,
        attack: u8,
        dash: u8,
    ) -> Result<()> {
        instructions::input::handle(ctx, dx, dy, attack, dash)
    }

    /// Advances one fixed step when at least 8 slots have passed.
    pub fn tick_arena(ctx: Context<TickArena>) -> Result<()> {
        instructions::tick::handle(ctx)
    }

    /// Advances to the next room after a clear. Session-signed; the seed is VRF.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn next_room(ctx: Context<NextRoom>) -> Result<()> {
        instructions::dungeon::next_room(ctx, instruction::DungeonCb::DISCRIMINATOR.to_vec())
    }

    /// Pays the boss chest once the glow roll lands.
    pub fn chest_cb(ctx: Context<ChestCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
        instructions::dungeon::consume_chest(ctx, randomness, nonce)
    }

    /// Stops the crank. A cleared sixth room banks the run and rolls the chest.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn exit_dungeon(ctx: Context<ExitDungeon>) -> Result<()> {
        instructions::exit::handle(ctx, instruction::ChestCb::DISCRIMINATOR.to_vec())
    }

    /// The workbench: materials pay out now, gear waits for one rarity roll.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn craft(ctx: Context<Craft>, recipe_id: u8) -> Result<()> {
        instructions::craft::request(ctx, recipe_id, instruction::CraftCb::DISCRIMINATOR.to_vec())
    }

    /// Writes the crafted gear's rarity and traits. The roll is not logged.
    pub fn craft_cb(ctx: Context<CraftCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
        instructions::craft::consume(ctx, randomness, nonce)
    }

    /// Sells one slot to Auntie Pell at the Charter price.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn merchant_sell(ctx: Context<MerchantSell>, slot: u8) -> Result<()> {
        instructions::merchant::sell(ctx, slot)
    }

    /// Buys one good from Auntie Pell's shop.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn merchant_buy(ctx: Context<MerchantBuy>, good: u16) -> Result<()> {
        instructions::merchant::buy(ctx, good)
    }

    /// Eats one meal from the pack. At most four a day.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn eat(ctx: Context<Eat>, slot: u8) -> Result<()> {
        instructions::eat::handle(ctx, slot)
    }

    /// Equips the gear in one pack slot. The dungeon reads it on entry.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn equip(ctx: Context<Equip>, slot: u8) -> Result<()> {
        instructions::equip::handle(ctx, slot)
    }

    /// Lists one pack slot on the Coldfair at a fixed price. 1 Glint deposit.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn list(ctx: Context<List>, slot: u8, price: u64) -> Result<()> {
        instructions::market::list(ctx, slot, price)
    }

    /// Takes an unsold listing back. The deposit stays burned.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn cancel_quoted(ctx: Context<Cancel>, listing: u8, revision: u64) -> Result<()> {
        instructions::market::cancel(ctx, listing, revision)
    }

    /// Buys a listing: both purses, the item and the Hearth Penny split move
    /// atomically.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn buy_quoted(ctx: Context<Buy>, listing: u8, revision: u64, expected_price: u64) -> Result<()> {
        instructions::market::buy(ctx, listing, revision, expected_price)
    }

    /// Strikes the anvil: the item, fodder and Glints go in, one VRF roll
    /// decides whether it comes out a rarity higher.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn strike(
        ctx: Context<Strike>,
        slot: u8,
        fodder: Vec<u8>,
        glints: u64,
    ) -> Result<()> {
        instructions::anvil::strike(
            ctx,
            slot,
            fodder,
            glints,
            instruction::StrikeCb::DISCRIMINATOR.to_vec(),
        )
    }

    /// The strike roll: a win raises the rarity, a crack returns scrap.
    pub fn strike_cb(ctx: Context<StrikeCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
        instructions::anvil::consume(ctx, randomness, nonce)
    }

    /// Steps into the Crater. The Glare runs here: a warm purse is marked.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn enter_lair(ctx: Context<EnterLair>) -> Result<()> {
        instructions::lair::enter(ctx, instruction::LairCb::DISCRIMINATOR.to_vec())
    }

    /// Writes the visit seed. The bytes are not logged.
    pub fn lair_cb(ctx: Context<LairCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
        instructions::lair::consume(ctx, randomness, nonce)
    }

    /// Stores the move the next lair tick will use.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn lair_input(
        ctx: Context<LairInput>,
        dx: i8,
        dy: i8,
        attack: u8,
        dash: u8,
    ) -> Result<()> {
        instructions::lair::input(ctx, dx, dy, attack, dash)
    }

    /// Advances one fixed 100 ms step of the visit. Anyone may call it.
    pub fn tick_lair(ctx: Context<TickLair>) -> Result<()> {
        instructions::lair::tick(ctx)
    }

    /// Leaves the Crater early. The flushed damage still counts.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn exit_lair(ctx: Context<ExitLair>) -> Result<()> {
        instructions::lair::exit(ctx)
    }

    /// Scoops a nearby spark into the purse.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn catch_spark(ctx: Context<CatchSpark>) -> Result<()> {
        instructions::lair::catch(ctx)
    }

    /// The admin schedules the season-clock crank once per season.
    pub fn schedule_world(ctx: Context<ScheduleWorld>) -> Result<()> {
        instructions::world::schedule(ctx)
    }

    /// One season-clock tick: phases, Pell's Wants, bounties. Anyone may call.
    pub fn tick_world(ctx: Context<TickWorld>) -> Result<()> {
        instructions::world::tick(ctx)
    }

    /// Sets a block into a built lantern post.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn place_gem(ctx: Context<PlaceGem>, slot: u8) -> Result<()> {
        instructions::village::place_gem(ctx, slot)
    }

    /// Takes a placed block back into the pack.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn take_gem(ctx: Context<TakeGem>, post: u8) -> Result<()> {
        instructions::village::take_gem(ctx, post)
    }

    /// Settles villager output into the pack.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn collect(ctx: Context<Collect>) -> Result<()> {
        instructions::village::collect(ctx)
    }

    /// Feeds the village stockpile from the pack.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn feed(ctx: Context<Feed>, slot: u8) -> Result<()> {
        instructions::village::feed(ctx, slot)
    }

    /// Rings the Hearth Bell. One VRF roll decides whether a wanderer comes.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn ring_bell(ctx: Context<RingBell>) -> Result<()> {
        instructions::village::ring_bell(ctx, instruction::BellCb::DISCRIMINATOR.to_vec())
    }

    /// The wanderer roll.
    pub fn bell_cb(ctx: Context<BellCb>, randomness: [u8; 32], nonce: u64) -> Result<()> {
        instructions::village::bell_cb(ctx, randomness, nonce)
    }

    /// Recruits the waiting wanderer for a 15-Glint gift.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn recruit(ctx: Context<Recruit>, slot: u8) -> Result<()> {
        instructions::village::recruit(ctx, slot)
    }

    /// The admin flips demo mode, which the season clock and chest odds read.
    pub fn set_demo_mode(ctx: Context<SetDemoMode>, demo: u8) -> Result<()> {
        instructions::demo::set_demo_mode(ctx, demo)
    }

    /// Demo grants, tagged DEMO. Works only in demo mode.
    pub fn demo_grant(ctx: Context<DemoGrant>, kind: u16, rarity: u8, shell: u8) -> Result<()> {
        instructions::demo::demo_grant(ctx, kind, rarity, shell)
    }

    /// Writes damage rows, and sets Old Gloam's HP to 0 when finish is 1.
    #[cfg(feature = "debug")]
    pub fn debug_kill(
        ctx: Context<DebugKill>,
        wallet: Vec<Pubkey>,
        damage: Vec<u64>,
        age_secs: Vec<u64>,
        flags: Vec<u8>,
        finish: u8,
    ) -> Result<()> {
        instructions::kill::handle(ctx, wallet, damage, age_secs, flags, finish)
    }

    /// Commits Season and schedules the payout record. Old Gloam's HP must be 0.
    pub fn settle_season(ctx: Context<SettleSeason>) -> Result<()> {
        instructions::settle::handle(ctx)
    }

    /// Writes the SOL split from the committed damage table.
    pub fn record_payout(ctx: Context<RecordPayout>) -> Result<()> {
        instructions::record::record(ctx)
    }

    /// Collects the wallet's Glint entitlement into its private rollup purse.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn claim_glints(ctx: Context<ClaimGlints>, season_number: u32) -> Result<()> {
        instructions::awards::claim(ctx, season_number)
    }

    /// Pays one unclaimed share from the Vault.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::record::claim(ctx)
    }

    /// The Ember Egg holder names the next wyrm (A–Z and spaces, up to 16 chars).
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn name_wyrm(ctx: Context<NameWyrm>, name: String) -> Result<()> {
        instructions::season::name_wyrm(ctx, name)
    }
}
