//! Whether a delegated account still belongs to this program.

use anchor_lang::prelude::*;

use crate::errors::GameError;

pub fn owner_of(account: &AccountInfo) -> Pubkey {
    *account.owner
}

pub fn still_ours(owner: &Pubkey) -> Result<bool> {
    if *owner == crate::ID {
        return Ok(true);
    }
    if owner.to_bytes() == ephemeral_rollups_sdk::id().to_bytes() {
        return Ok(false);
    }
    err!(GameError::BadAccount)
}
