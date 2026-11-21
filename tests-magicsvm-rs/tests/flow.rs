//! One season, in process: sign-up, gather, thaw, one arena tick, an exit, then the payout.

use ephemeral_rollups_sdk::consts::MAGIC_CONTEXT_ID;
use magicsvm::TransactionTarget;
use sunhoard::{accounts, instruction, state};
use sunhoard_magicsvm_tests::{
    boot, delegated, delegation, ephemeral_vault, escrow, fulfill, i64_at, identity, ix, magic,
    owned, permission, permission_program, read, send, shared, system, u32_at, u64_at, validator,
    warp, Shared, World, QUEUE, SLOT_HASHES, VRF,
};

const BASE: TransactionTarget = TransactionTarget::Base;
const ROLLUP: TransactionTarget = TransactionTarget::Ephemeral;

#[test]
fn m1_runs_from_sign_up_through_a_claim() {
    let mut world = boot();
    let shared = shared();
    let owned = owned(&world.key);
    create(&mut world, &shared, &owned);
    delegate_all(&mut world, &shared, &owned);
    open_season(&mut world, &shared);
    join_world(&mut world, &shared, &owned);
    gather(&mut world, &owned);
    thaw(&mut world, &shared, &owned);
    tick(&mut world, &owned);
    leave(&mut world, &owned);
    pay(&mut world, &shared);
}

fn create(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
    send(world, BASE, init_game(world, shared), "init_game");
    send(world, BASE, init_payout(world, shared), "init_payout");
    send(world, BASE, sign_up(world, owned), "sign_up");
    grant_glints(world, owned);
    let player = read(world, BASE, &owned.player);
    assert_eq!(
        u32_at(
            &player,
            8 + core::mem::offset_of!(state::Player, player_number)
        ),
        0
    );
}

fn delegate_all(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
    send(
        world,
        BASE,
        delegate_shared(world, shared),
        "delegate_shared",
    );
    send(
        world,
        BASE,
        delegate_player(world, owned),
        "delegate_player",
    );
    send(world, BASE, delegate_home(world, owned), "delegate_home");
    assert!(test_utils::is_delegated(
        &world.svm,
        &test_utils::as_address(shared.season)
    ));
    send(
        world,
        ROLLUP,
        permissions(world, shared),
        "set_permissions_shared",
    );
    stranger_cannot_read_world(world, shared);
}

fn stranger_cannot_read_world(world: &mut World, shared: &Shared) {
    let stranger = solana_address::Address::new_unique();
    world.svm.set_authorized_user(Some(stranger));
    let hidden = world
        .svm
        .get_account_for(ROLLUP, &test_utils::as_address(shared.world));
    assert!(hidden.is_none(), "a non-member read World");
    let season = world
        .svm
        .get_account_for(ROLLUP, &test_utils::as_address(shared.season));
    assert!(season.is_some(), "Season stays public");
    world.svm.set_authorized_user(None);
}

fn open_season(world: &mut World, shared: &Shared) {
    send(world, ROLLUP, start_season(world, shared), "start_season");
    fulfill(world, 1);
    let data = read(world, ROLLUP, &shared.season);
    let number = u32_at(
        &data,
        8 + core::mem::offset_of!(state::Season, season_number),
    );
    assert_eq!(number, 1);
    let world_data = read(world, ROLLUP, &shared.world);
    assert!(u64_at(&world_data, 8 + core::mem::offset_of!(state::World, hp)) > 0);
}

fn join_world(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
    send(world, ROLLUP, join(world, shared, owned), "join");
    let player = read(world, ROLLUP, &owned.player);
    assert_eq!(
        u32_at(
            &player,
            8 + core::mem::offset_of!(state::Player, player_number)
        ),
        1
    );
    send(
        world,
        ROLLUP,
        ix(
            instruction::PostPosition {
                x: 0,
                y: 0,
                zone: 1,
                facing: 0,
            },
            accounts::PostPosition {
                payer: world.key,
                player: owned.player,
                presence: shared.presence,
                session_token: None,
            },
        ),
        "post_position",
    );
}

fn gather(world: &mut World, owned: &sunhoard_magicsvm_tests::Owned) {
    send(
        world,
        ROLLUP,
        ix(
            instruction::Gather {
                node: 0,
                node_x: 0,
                node_y: 0,
            },
            accounts::Gather {
                payer: world.key,
                player: owned.player,
                inventory: owned.inventory,
                oracle_queue: QUEUE,
                session_token: None,
                program_identity: identity(),
                vrf_program: VRF,
                slot_hashes: SLOT_HASHES,
                system_program: system(),
            },
        ),
        "gather",
    );
    let packed = read(world, ROLLUP, &owned.inventory);
    let count_at = 8 + core::mem::offset_of!(state::Inventory, count);
    assert!(
        packed[count_at] >= 2,
        "the base yield lands before the roll"
    );
    fulfill(world, 1);
}

fn thaw(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
    send(
        world,
        ROLLUP,
        ix(
            instruction::DebugGrant {},
            accounts::DebugGrant {
                admin: world.key,
                season: shared.season,
                world: shared.world,
                player: owned.player,
                inventory: owned.inventory,
            },
        ),
        "debug_grant",
    );
    let slot = sealed_slot(&read(world, ROLLUP, &owned.inventory));
    send(world, ROLLUP, crack(world, shared, owned, slot), "crack");
    warp(world, 1);
    send(
        world,
        ROLLUP,
        reveal(world, shared, owned, slot),
        "crack_reveal",
    );
}

fn sealed_slot(data: &[u8]) -> u8 {
    let start = 8 + core::mem::offset_of!(state::Inventory, slots);
    let stride = core::mem::size_of::<state::ItemSlot>();
    let flags_at = core::mem::offset_of!(state::ItemSlot, flags);
    for index in 0..state::INVENTORY_SLOTS {
        let flags = data[start + index * stride + flags_at];
        if flags & state::SEALED != 0 {
            return u8::try_from(index).expect("slot");
        }
    }
    panic!("no sealed shell");
}

fn tick(world: &mut World, owned: &sunhoard_magicsvm_tests::Owned) {
    send(world, ROLLUP, enter(world, owned), "enter_dungeon");
    let mut armed = read(world, ROLLUP, &owned.arena);
    for _ in 0..4 {
        warp(world, 1);
        armed = read(world, ROLLUP, &owned.arena);
        if armed[8 + core::mem::offset_of!(state::Arena, mode)] == state::MODE_FIGHT {
            break;
        }
    }
    assert_eq!(
        armed[8 + core::mem::offset_of!(state::Arena, mode)],
        state::MODE_FIGHT
    );
    send(
        world,
        ROLLUP,
        ix(
            instruction::ArenaInput {
                dx: 1,
                dy: 0,
                attack: 0,
                dash: 0,
            },
            accounts::ArenaInput {
                payer: world.key,
                player: owned.player,
                arena: owned.arena,
                session_token: None,
            },
        ),
        "arena_input",
    );
    let before = u64_at(&armed, 8 + core::mem::offset_of!(state::Arena, step_index));
    warp(world, 8);
    let after = read(world, ROLLUP, &owned.arena);
    let stepped = u64_at(&after, 8 + core::mem::offset_of!(state::Arena, step_index));
    assert!(stepped > before, "a crank tick advances the room");
}

fn leave(world: &mut World, owned: &sunhoard_magicsvm_tests::Owned) {
    send(
        world,
        ROLLUP,
        ix(
            instruction::ExitDungeon {},
            accounts::ExitDungeon {
                payer: world.key,
                player: owned.player,
                arena: owned.arena,
                purse: owned.purse,
                inventory: owned.inventory,
                magic_program: magic(),
                task_context: world.key,
                session_token: None,
            },
        ),
        "exit_dungeon",
    );
    let left = read(world, ROLLUP, &owned.arena);
    assert_eq!(
        left[8 + core::mem::offset_of!(state::Arena, mode)],
        state::MODE_IDLE
    );
    assert_eq!(
        i64_at(&left, 8 + core::mem::offset_of!(state::Arena, task_id)),
        0
    );
}

fn pay(world: &mut World, shared: &Shared) {
    send(
        world,
        ROLLUP,
        ix(
            instruction::DebugKill {
                wallet: vec![world.key],
                damage: vec![1_000],
                age_secs: vec![86_400],
                flags: vec![state::CLEARED_T1 | state::IS_KILLER],
                finish: 1,
            },
            accounts::DebugKill {
                admin: world.key,
                season: shared.season,
                world: shared.world,
            },
        ),
        "debug_kill",
    );
    let before = test_utils::as_address(world.key);
    let start = sunhoard_magicsvm_tests::lamports(world, &before);
    send(world, ROLLUP, settle(world, shared), "settle_season");
    let payout = read(world, BASE, &shared.payout);
    assert_eq!(
        u64_at(
            &payout,
            8 + core::mem::offset_of!(state::Payout, season_number)
        ),
        1
    );
    send(world, BASE, claim(world, shared), "claim");
    assert!(sunhoard_magicsvm_tests::lamports(world, &before) > start);
}

fn grant_glints(world: &mut World, owned: &sunhoard_magicsvm_tests::Owned) {
    let address = test_utils::as_address(owned.purse);
    let mut account = world.svm.get_account(&address).expect("purse");
    let at = 8 + core::mem::offset_of!(state::Purse, glints);
    account.data[at..at + 8].copy_from_slice(&500u64.to_le_bytes());
    world
        .svm
        .set_account(address, account)
        .expect("purse write");
}

fn init_game(world: &World, shared: &Shared) -> solana_instruction::Instruction {
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

fn init_payout(world: &World, shared: &Shared) -> solana_instruction::Instruction {
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

fn sign_up(
    world: &World,
    owned: &sunhoard_magicsvm_tests::Owned,
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

fn delegate_shared(world: &World, shared: &Shared) -> solana_instruction::Instruction {
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

fn delegate_player(
    world: &World,
    owned: &sunhoard_magicsvm_tests::Owned,
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

fn delegate_home(
    world: &World,
    owned: &sunhoard_magicsvm_tests::Owned,
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

fn permissions(world: &World, shared: &Shared) -> solana_instruction::Instruction {
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

fn start_season(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    ix(
        instruction::StartSeason {},
        accounts::StartSeason {
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

fn join(
    world: &World,
    shared: &Shared,
    owned: &sunhoard_magicsvm_tests::Owned,
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

fn crack(
    world: &World,
    shared: &Shared,
    owned: &sunhoard_magicsvm_tests::Owned,
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
            session_token: None,
        },
    )
}

fn reveal(
    world: &World,
    shared: &Shared,
    owned: &sunhoard_magicsvm_tests::Owned,
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
            session_token: None,
        },
    )
}

fn enter(world: &World, owned: &sunhoard_magicsvm_tests::Owned) -> solana_instruction::Instruction {
    ix(
        instruction::EnterDungeon {},
        accounts::EnterDungeon {
            payer: world.key,
            player: owned.player,
            arena: owned.arena,
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

fn settle(world: &World, shared: &Shared) -> solana_instruction::Instruction {
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

fn claim(world: &World, shared: &Shared) -> solana_instruction::Instruction {
    ix(
        instruction::Claim {},
        accounts::Claim {
            wallet: world.key,
            payout: shared.payout,
            vault: shared.vault,
        },
    )
}
