//! Names copied from magicblock-examples. This module exists so the pinned SDK
//! features fail to compile if crates.io 0.16.2 is missing one of them.
//! `ScheduleTaskArgs` is public on `magicblock-magic-program-api` 0.10.1, which
//! is the copy SDK 0.16.2 already uses. The SDK itself does not re-export it.

use ephemeral_rollups_sdk::access_control::instructions::CreateEphemeralPermissionCpi;
use ephemeral_rollups_sdk::crank::ScheduleCrankCpi;
use ephemeral_rollups_sdk::vrf::instructions::create_request_scoped_randomness_ix;
use magicblock_magic_program_api::args::ScheduleTaskArgs;
use session_keys::SessionTokenV2;

#[allow(dead_code)]
pub fn linked() -> usize {
    let request = create_request_scoped_randomness_ix;
    core::mem::size_of::<ScheduleTaskArgs>()
        + core::mem::size_of_val(&request)
        + core::mem::size_of::<ScheduleCrankCpi>()
        + core::mem::size_of::<CreateEphemeralPermissionCpi>()
        + core::mem::size_of::<SessionTokenV2>()
}

#[cfg(test)]
mod tests {
    use super::linked;

    #[test]
    fn sdk_names_link() {
        assert!(linked() > 0);
    }
}
