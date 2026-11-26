//! Chain instruction handlers. Each one calls `crate::logic` for the rules.

pub mod anvil;
pub mod awards;
mod committed;
pub mod crack;
pub mod craft;
mod crank_ix;
#[cfg(feature = "debug")]
pub mod debug;
pub mod delegate_player;
pub mod delegate_shared;
pub mod demo;
pub mod dungeon;
pub mod eat;
pub mod equip;
pub mod exit;
mod fight_io;
pub mod gather;
pub mod init_game;
pub mod init_payout;
pub mod input;
pub mod join;
#[cfg(feature = "debug")]
pub mod kill;
pub mod lair;
mod lair_io;
mod lair_tally;
pub mod market;
pub mod merchant;
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
pub mod village;
pub mod world;
