//! Sunhoard program. `logic` is pure Rust. Instructions call it.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod constants_stub;
pub mod errors;
pub mod instructions;
pub mod logic;
mod sdk;
pub mod state;

declare_id!("FxqDh8g5KcZbEzg4AJsX5yUit6A63BC5PoncdWjtBKqS");

// The program macro generates handlers at the crate root. The Accounts derive
// emits its helper modules next to the struct, so both are re-exported here.
pub(crate) use instructions::crack::__client_accounts_crack;
pub(crate) use instructions::crack::__client_accounts_crack_reveal;
#[cfg(feature = "cpi")]
pub(crate) use instructions::crack::__cpi_client_accounts_crack;
#[cfg(feature = "cpi")]
pub(crate) use instructions::crack::__cpi_client_accounts_crack_reveal;
pub use instructions::crack::{Crack, CrackReveal};
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
pub(crate) use instructions::dungeon::__client_accounts_dungeon_cb;
pub(crate) use instructions::dungeon::__client_accounts_enter_dungeon;
#[cfg(feature = "cpi")]
pub(crate) use instructions::dungeon::__cpi_client_accounts_dungeon_cb;
#[cfg(feature = "cpi")]
pub(crate) use instructions::dungeon::__cpi_client_accounts_enter_dungeon;
pub use instructions::dungeon::{DungeonCb, EnterDungeon};
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
#[cfg(feature = "debug")]
pub use instructions::kill::DebugKill;
#[cfg(feature = "debug")]
pub(crate) use instructions::kill::__client_accounts_debug_kill;
#[cfg(all(feature = "debug", feature = "cpi"))]
pub(crate) use instructions::kill::__cpi_client_accounts_debug_kill;
pub use instructions::permissions::SetPermissionsShared;
pub(crate) use instructions::permissions::__client_accounts_set_permissions_shared;
#[cfg(feature = "cpi")]
pub(crate) use instructions::permissions::__cpi_client_accounts_set_permissions_shared;
pub use instructions::position::PostPosition;
pub(crate) use instructions::position::__client_accounts_post_position;
#[cfg(feature = "cpi")]
pub(crate) use instructions::position::__cpi_client_accounts_post_position;
pub(crate) use instructions::record::__client_accounts_claim;
pub(crate) use instructions::record::__client_accounts_record_payout;
#[cfg(feature = "cpi")]
pub(crate) use instructions::record::__cpi_client_accounts_claim;
#[cfg(feature = "cpi")]
pub(crate) use instructions::record::__cpi_client_accounts_record_payout;
pub use instructions::record::{Claim, RecordPayout};
pub(crate) use instructions::season::__client_accounts_salt_cb;
pub(crate) use instructions::season::__client_accounts_start_season;
#[cfg(feature = "cpi")]
pub(crate) use instructions::season::__cpi_client_accounts_salt_cb;
#[cfg(feature = "cpi")]
pub(crate) use instructions::season::__cpi_client_accounts_start_season;
pub use instructions::season::{SaltCb, StartSeason};
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

    /// Stops the crank and banks a clear.
    #[session_auth_or(
        ctx.accounts.player.owner == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn exit_dungeon(ctx: Context<ExitDungeon>) -> Result<()> {
        instructions::exit::handle(ctx)
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

    /// Pays one unclaimed share from the Vault.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::record::claim(ctx)
    }
}
