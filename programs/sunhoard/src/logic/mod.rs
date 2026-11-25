//! Pure game rules. No Anchor, no accounts, no clocks except values the caller passes in.

pub mod anvil;
pub mod arena;
pub mod chest;
pub mod combat;
pub mod craft;
pub mod fight;
pub mod gather;
pub mod ids;
pub mod lair;
pub mod market;
pub mod math;
pub mod merchant;
pub mod numbers;
pub mod payout;
pub mod roll;
pub mod seal;
pub mod season;
pub mod travel;
pub mod world;

pub use arena::{step_arena, ArenaSim, Intent, Shot};
pub use chest::{first_clear_block, roll_chest, ChestRoll};
pub use combat::Weapon;
pub use craft::{recipe_by_id, roll_rarity, roll_traits, Recipe, TraitRoll};
pub use fight::{open_room, room_clear, step_fight, stone_weapon, Fight, Fighter, Foe};
pub use gather::{
    aurora_up, cooldown_ready, gather_base, gather_callback, in_gather_range, refill_energy,
    GatherBase, GatherExtra, ToolBonus,
};
pub use payout::{split_pot, DamageRow, Split};
pub use seal::{commitment, reveal_shell, seal_key, thaw_fee, Gem, RevealedShell};
pub use season::{item_id, sealed_hp};
pub use travel::{move_allowed, MAX_ZONE};
