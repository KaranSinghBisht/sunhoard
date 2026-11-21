//! Chain instruction handlers. Each one calls `crate::logic` for the rules.

mod committed;
pub mod crack;
mod crank_ix;
#[cfg(feature = "debug")]
pub mod debug;
pub mod delegate_player;
pub mod delegate_shared;
pub mod dungeon;
pub mod exit;
mod fight_io;
pub mod gather;
pub mod init_game;
pub mod init_payout;
pub mod input;
pub mod join;
#[cfg(feature = "debug")]
pub mod kill;
mod mint;
mod owner;
mod pay;
pub mod permissions;
pub mod position;
pub mod record;
pub mod season;
pub mod settle;
pub mod signup;
mod stack;
pub mod tick;
