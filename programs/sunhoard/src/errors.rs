use anchor_lang::prelude::*;

/// Failures a player can see. The text never includes account data.
#[error_code]
pub enum GameError {
    #[msg("That amount is not allowed.")]
    BadAmount,
    #[msg("That account does not match.")]
    BadAccount,
    #[msg("That action is not available yet.")]
    NotReady,
    #[msg("Your pack is full.")]
    Full,
}

/// Rule failures. The program maps these to player-facing errors later.
/// Variants stay generic so a message never includes account data.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LogicError {
    BadNode,
    BadShell,
    BadMaterial,
    BadRarity,
    BadIntent,
    BadEnergy,
    BadRoom,
    Full,
    ManyKillers,
    TooManyRows,
    Overflow,
}
