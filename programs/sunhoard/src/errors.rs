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
    #[msg("Old Gloam has fallen. The sun is free.")]
    SunFree,
    #[msg("That listing changed or expired. Refresh the Coldfair.")]
    ChangedListing,
    #[msg("This legacy shell has lost its seal. No thaw fee was charged.")]
    LostSeal,
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
    BadAmount,
    Full,
    ManyKillers,
    TooManyRows,
    Overflow,
}
