//! The next item id for this player. The counter is the last id used.

use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::logic::item_id;
use crate::state::Player;

pub(crate) fn next_item_id(player: &mut Player) -> Result<u64> {
    if player.player_number == 0 {
        return err!(GameError::NotReady);
    }
    let counter = player
        .item_counter
        .checked_add(1)
        .ok_or(error!(GameError::NotReady))?;
    let id = item_id(player.player_number, counter).map_err(|_| error!(GameError::NotReady))?;
    player.item_counter = counter;
    Ok(id)
}
