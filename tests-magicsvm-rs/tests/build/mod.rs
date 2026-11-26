//! Instruction builders for the flows. Each one names every account the
//! instruction takes, the way a client would.

use ephemeral_rollups_sdk::consts::MAGIC_CONTEXT_ID;
use sunhoard::{accounts, instruction};

use super::shared_market;
use sunhoard_magicsvm_tests::{
    delegated, delegation, ephemeral_vault, escrow, identity, ix, magic, permission,
    permission_program, system, validator, Owned, Shared, World, QUEUE, SLOT_HASHES, VRF,
};

pub fn list(
    world: &World,
    shared: &Shared,
    owned: &Owned,
    slot: u8,
    price: u64,
) -> solana_instruction::Instruction {
    ix(
        instruction::List { slot, price },
        accounts::List {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            purse: owned.purse,
            market: shared.market,
            season: shared.season,
            session_token: None,
        },
    )
}

pub fn cancel(
    world: &World,
    owned: &Owned,
    listing: u8,
) -> solana_instruction::Instruction {
    ix(
        instruction::CancelQuoted { listing, revision: 1 },
        accounts::Cancel {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            market: shared_market(world),
            session_token: None,
        },
    )
}

pub fn strike(
    world: &World,
    shared: &Shared,
    owned: &Owned,
    slot: u8,
    fodder: Vec<u8>,
    glints: u64,
) -> solana_instruction::Instruction {
    ix(
        instruction::Strike { slot, fodder, glints },
        accounts::Strike {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            purse: owned.purse,
            season: shared.season,
            oracle_queue: QUEUE,
            session_token: None,
            program_identity: identity(),
            vrf_program: VRF,
            slot_hashes: SLOT_HASHES,
            system_program: system(),
        },
    )
}

pub fn enter_lair(
    world: &World,
    shared: &Shared,
    owned: &Owned,
) -> solana_instruction::Instruction {
    ix(
        instruction::EnterLair {},
        accounts::EnterLair {
            payer: world.key,
            player: owned.player,
            arena: owned.arena,
            inventory: owned.inventory,
            purse: owned.purse,
            season: shared.season,
            world: shared.world,
            oracle_queue: QUEUE,
            magic_program: magic(),
            session_token: None,
            program_identity: identity(),
            vrf_program: VRF,
            slot_hashes: SLOT_HASHES,
            system_program: system(),
        },
    )
}

pub fn exit_lair(
    world: &World,
    shared: &Shared,
    owned: &Owned,
) -> solana_instruction::Instruction {
    ix(
        instruction::ExitLair {},
        accounts::ExitLair {
            payer: world.key,
            player: owned.player,
            arena: owned.arena,
            season: shared.season,
            world: shared.world,
            magic_program: magic(),
            task_context: world.key,
            session_token: None,
        },
    )
}

pub fn place_gem(
    world: &World,
    owned: &Owned,
    slot: u8,
) -> solana_instruction::Instruction {
    ix(
        instruction::PlaceGem { slot },
        accounts::PlaceGem {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            village: owned.village,
            session_token: None,
        },
    )
}

pub fn take_gem(
    world: &World,
    owned: &Owned,
    post: u8,
) -> solana_instruction::Instruction {
    ix(
        instruction::TakeGem { post },
        accounts::TakeGem {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            village: owned.village,
            session_token: None,
        },
    )
}

pub fn ring_bell(
    world: &World,
    shared: &Shared,
    owned: &Owned,
) -> solana_instruction::Instruction {
    ix(
        instruction::RingBell {},
        accounts::RingBell {
            payer: world.key,
            player: owned.player,
            village: owned.village,
            season: shared.season,
            oracle_queue: QUEUE,
            session_token: None,
            program_identity: identity(),
            vrf_program: VRF,
            slot_hashes: SLOT_HASHES,
            system_program: system(),
        },
    )
}

pub fn collect(world: &World, owned: &Owned) -> solana_instruction::Instruction {
    ix(
        instruction::Collect {},
        accounts::Collect {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            village: owned.village,
            session_token: None,
        },
    )
}

pub fn set_demo_mode(
    world: &World,
    shared: &Shared,
    demo: u8,
) -> solana_instruction::Instruction {
    ix(
        instruction::SetDemoMode { demo },
        accounts::SetDemoMode {
            admin: world.key,
            season: shared.season,
        },
    )
}

pub fn demo_grant(
    world: &World,
    shared: &Shared,
    owned: &Owned,
    kind: u16,
    rarity: u8,
    shell: u8,
) -> solana_instruction::Instruction {
    ix(
        instruction::DemoGrant { kind, rarity, shell },
        accounts::DemoGrant {
            admin: world.key,
            season: shared.season,
            world: shared.world,
            player: owned.player,
            inventory: owned.inventory,
        },
    )
}

pub fn schedule_world(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    ix(
        instruction::ScheduleWorld {},
        accounts::ScheduleWorld {
            admin: world.key,
            season: shared.season,
            world: shared.world,
            prices: shared.prices,
            magic_program: magic(),
        },
    )
}

pub fn tick_world(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    ix(
        instruction::TickWorld {},
        accounts::TickWorld {
            season: shared.season,
            world: shared.world,
            prices: shared.prices,
        },
    )
}

pub fn merchant_buy(
    world: &World,
    owned: &Owned,
    good: u16,
) -> solana_instruction::Instruction {
    ix(
        instruction::MerchantBuy { good },
        accounts::MerchantBuy {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            purse: owned.purse,
            session_token: None,
        },
    )
}

pub fn merchant_sell(
    world: &World,
    shared: &Shared,
    owned: &Owned,
    slot: u8,
) -> solana_instruction::Instruction {
    ix(
        instruction::MerchantSell { slot },
        accounts::MerchantSell {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            purse: owned.purse,
            prices: shared.prices,
            session_token: None,
        },
    )
}

pub fn craft(
    world: &World,
    owned: &Owned,
    recipe_id: u8,
) -> solana_instruction::Instruction {
    ix(
        instruction::Craft { recipe_id },
        accounts::Craft {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            village: owned.village,
            oracle_queue: QUEUE,
            session_token: None,
            program_identity: identity(),
            vrf_program: VRF,
            slot_hashes: SLOT_HASHES,
            system_program: system(),
        },
    )
}

pub fn eat(world: &World, owned: &Owned, slot: u8) -> solana_instruction::Instruction {
    ix(
        instruction::Eat { slot },
        accounts::Eat {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            session_token: None,
        },
    )
}

pub fn equip(world: &World, owned: &Owned, slot: u8) -> solana_instruction::Instruction {
    ix(
        instruction::Equip { slot },
        accounts::Equip {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            session_token: None,
        },
    )
}

pub fn next_room(world: &World, owned: &Owned) -> solana_instruction::Instruction {
    ix(
        instruction::NextRoom {},
        accounts::NextRoom {
            payer: world.key,
            player: owned.player,
            arena: owned.arena,
            oracle_queue: QUEUE,
            magic_program: magic(),
            task_context: world.key,
            session_token: None,
            program_identity: identity(),
            vrf_program: VRF,
            slot_hashes: SLOT_HASHES,
            system_program: system(),
        },
    )
}

pub fn init_game(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    ix(
        instruction::InitGame {
            vault_lamports: 1_000_000_000,
        },
        accounts::InitGame {
            admin: world.key,
            season: shared.season,
            world: shared.world,
            market: shared.market,
            prices: shared.prices,
            presence: shared.presence,
            vault: shared.vault,
            escrow: escrow(&world.key),
            delegation_program: delegation(),
            system_program: system(),
        },
    )
}

pub fn init_payout(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    ix(
        instruction::InitPayout {},
        accounts::InitPayout {
            admin: world.key,
            vault: shared.vault,
            payout: shared.payout,
            system_program: system(),
        },
    )
}

pub fn sign_up(
    world: &World,
    owned: &Owned,
) -> solana_instruction::Instruction {
    ix(
        instruction::SignUp {},
        accounts::SignUp {
            owner: world.key,
            player: owned.player,
            purse: owned.purse,
            inventory: owned.inventory,
            village: owned.village,
            arena: owned.arena,
            view: owned.view,
            system_program: system(),
        },
    )
}

pub fn delegate_shared(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    let season = delegated(&shared.season);
    let globe = delegated(&shared.world);
    let market = delegated(&shared.market);
    let prices = delegated(&shared.prices);
    let presence = delegated(&shared.presence);
    ix(
        instruction::DelegateShared {},
        accounts::DelegateShared {
            admin: world.key,
            vault: shared.vault,
            buffer_season: season.buffer,
            delegation_record_season: season.record,
            delegation_metadata_season: season.metadata,
            season: shared.season,
            buffer_world: globe.buffer,
            delegation_record_world: globe.record,
            delegation_metadata_world: globe.metadata,
            world: shared.world,
            buffer_market: market.buffer,
            delegation_record_market: market.record,
            delegation_metadata_market: market.metadata,
            market: shared.market,
            buffer_prices: prices.buffer,
            delegation_record_prices: prices.record,
            delegation_metadata_prices: prices.metadata,
            prices: shared.prices,
            buffer_presence: presence.buffer,
            delegation_record_presence: presence.record,
            delegation_metadata_presence: presence.metadata,
            presence: shared.presence,
            validator: validator(world),
            owner_program: sunhoard::ID,
            delegation_program: delegation(),
            system_program: system(),
        },
    )
}

pub fn delegate_player(
    world: &World,
    owned: &Owned,
) -> solana_instruction::Instruction {
    let player = delegated(&owned.player);
    let purse = delegated(&owned.purse);
    let inventory = delegated(&owned.inventory);
    ix(
        instruction::DelegatePlayer {},
        accounts::DelegatePlayer {
            owner: world.key,
            buffer_player: player.buffer,
            delegation_record_player: player.record,
            delegation_metadata_player: player.metadata,
            player: owned.player,
            buffer_purse: purse.buffer,
            delegation_record_purse: purse.record,
            delegation_metadata_purse: purse.metadata,
            purse: owned.purse,
            buffer_inventory: inventory.buffer,
            delegation_record_inventory: inventory.record,
            delegation_metadata_inventory: inventory.metadata,
            inventory: owned.inventory,
            validator: validator(world),
            owner_program: sunhoard::ID,
            delegation_program: delegation(),
            system_program: system(),
        },
    )
}

pub fn delegate_home(
    world: &World,
    owned: &Owned,
) -> solana_instruction::Instruction {
    let village = delegated(&owned.village);
    let arena = delegated(&owned.arena);
    let view = delegated(&owned.view);
    ix(
        instruction::DelegateHome {},
        accounts::DelegateHome {
            owner: world.key,
            buffer_village: village.buffer,
            delegation_record_village: village.record,
            delegation_metadata_village: village.metadata,
            village: owned.village,
            buffer_arena: arena.buffer,
            delegation_record_arena: arena.record,
            delegation_metadata_arena: arena.metadata,
            arena: owned.arena,
            buffer_view: view.buffer,
            delegation_record_view: view.record,
            delegation_metadata_view: view.metadata,
            view: owned.view,
            validator: validator(world),
            owner_program: sunhoard::ID,
            delegation_program: delegation(),
            system_program: system(),
        },
    )
}

pub fn permissions(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    ix(
        instruction::SetPermissionsShared {},
        accounts::SetPermissionsShared {
            admin: world.key,
            season: shared.season,
            season_permission: permission(&shared.season),
            world: shared.world,
            world_permission: permission(&shared.world),
            market: shared.market,
            market_permission: permission(&shared.market),
            prices: shared.prices,
            prices_permission: permission(&shared.prices),
            presence: shared.presence,
            presence_permission: permission(&shared.presence),
            permission_program: permission_program(),
            ephemeral_vault: ephemeral_vault(),
            magic_program: magic(),
        },
    )
}

pub fn start_season(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    ix(
        instruction::StartSeason {},
        accounts::StartSeason {
            payout: shared.payout,
            admin: world.key,
            season: shared.season,
            world: shared.world,
            oracle_queue: QUEUE,
            program_identity: identity(),
            vrf_program: VRF,
            slot_hashes: SLOT_HASHES,
            system_program: system(),
        },
    )
}

pub fn join(
    world: &World,
    shared: &Shared,
    owned: &Owned,
) -> solana_instruction::Instruction {
    ix(
        instruction::Join {},
        accounts::Join {
            owner: world.key,
            season: shared.season,
            player: owned.player,
            purse: owned.purse,
            purse_permission: permission(&owned.purse),
            view: owned.view,
            view_permission: permission(&owned.view),
            inventory: owned.inventory,
            village: owned.village,
            permission_program: permission_program(),
            ephemeral_vault: ephemeral_vault(),
            magic_program: magic(),
        },
    )
}

pub fn crack(
    world: &World,
    shared: &Shared,
    owned: &Owned,
    slot: u8,
) -> solana_instruction::Instruction {
    ix(
        instruction::Crack { slot },
        accounts::Crack {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            purse: owned.purse,
            season: shared.season,
            world: shared.world,
            session_token: None,
        },
    )
}

pub fn reveal(
    world: &World,
    shared: &Shared,
    owned: &Owned,
    slot: u8,
) -> solana_instruction::Instruction {
    ix(
        instruction::CrackReveal { slot },
        accounts::CrackReveal {
            payer: world.key,
            player: owned.player,
            inventory: owned.inventory,
            purse: owned.purse,
            world: shared.world,
            season: shared.season,
            session_token: None,
        },
    )
}

pub fn enter(world: &World, owned: &Owned) -> solana_instruction::Instruction {
    ix(
        instruction::EnterDungeon {},
        accounts::EnterDungeon {
            payer: world.key,
            player: owned.player,
            arena: owned.arena,
            inventory: owned.inventory,
            oracle_queue: QUEUE,
            magic_program: magic(),
            session_token: None,
            program_identity: identity(),
            vrf_program: VRF,
            slot_hashes: SLOT_HASHES,
            system_program: system(),
        },
    )
}

pub fn settle(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    ix(
        instruction::SettleSeason {},
        accounts::SettleSeason {
            admin: world.key,
            season: shared.season,
            world: shared.world,
            payout: shared.payout,
            vault: shared.vault,
            program_id: sunhoard::ID,
            magic_program: magic(),
            magic_context: MAGIC_CONTEXT_ID,
        },
    )
}

pub fn claim(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    ix(
        instruction::Claim {},
        accounts::Claim {
            wallet: world.key,
            payout: shared.payout,
            vault: shared.vault,
        },
    )
}
