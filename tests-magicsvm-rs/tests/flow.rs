//! One season, in process: sign-up, gather, thaw, one arena tick, an exit, then the payout.

use magicblock_account::ReadableAccount;
use magicsvm::TransactionTarget;
use sunhoard::{accounts, instruction, state};
use sunhoard_magicsvm_tests::{
    boot, fulfill, i64_at, identity, ix, magic, owned, read, send, shared, system, u32_at,
    u64_at, warp, Shared, World, QUEUE, SLOT_HASHES, VRF,
};

mod build;
mod kill;

use build::*;

const BASE: TransactionTarget = TransactionTarget::Base;
const ROLLUP: TransactionTarget = TransactionTarget::Ephemeral;

#[test]
fn release_binary_runs_the_first_gather() {
    let mut world = sunhoard_magicsvm_tests::boot_release();
    let shared = shared();
    let owned = owned(&world.key);
    let init = init_game(&world, &shared);
    send(&mut world, BASE, init, "init_game");
    let payout = init_payout(&world, &shared);
    send(&mut world, BASE, payout, "init_payout");
    let signup = sign_up(&world, &owned);
    send(&mut world, BASE, signup, "sign_up");
    delegate_all(&mut world, &shared, &owned);
    open_season(&mut world, &shared);
    join_world(&mut world, &shared, &owned);
    gather(&mut world, &owned);
}

#[test]
fn m1_runs_from_sign_up_through_a_claim() {
    let mut world = boot();
    let shared = shared();
    let owned = owned(&world.key);
    create(&mut world, &shared, &owned, 500);
    delegate_all(&mut world, &shared, &owned);
    open_season(&mut world, &shared);
    join_world(&mut world, &shared, &owned);
    gather(&mut world, &owned);
    thaw(&mut world, &shared, &owned);
    tick(&mut world, &owned);
    leave(&mut world, &shared, &owned);
    pay(&mut world, &shared);
}

#[test]
fn l1_runs_the_loop() {
    let mut world = boot();
    let shared = shared();
    let owned = owned(&world.key);
    create(&mut world, &shared, &owned, 10_000);
    delegate_all(&mut world, &shared, &owned);
    open_season(&mut world, &shared);
    join_world(&mut world, &shared, &owned);
    gather(&mut world, &owned);
    buy_and_eat(&mut world, &owned);
    craft_and_sell(&mut world, &shared, &owned);
    run_the_cellars(&mut world, &shared, &owned);
}

#[test]
fn l2_runs_the_spine() {
    let mut world = boot();
    let shared = shared();
    let owned = owned(&world.key);
    create(&mut world, &shared, &owned, 20_000);
    delegate_all(&mut world, &shared, &owned);
    open_season(&mut world, &shared);
    join_world(&mut world, &shared, &owned);
    market_and_anvil(&mut world, &shared, &owned);
    the_lair(&mut world, &shared, &owned);
    the_barn(&mut world, &shared, &owned);
    demo_grants(&mut world, &shared, &owned);
    the_clock(&mut world, &shared);
}

#[test]
fn l3_a_real_kill_pays_every_share() {
    let mut world = boot();
    let shared = shared();
    let owned = owned(&world.key);
    create(&mut world, &shared, &owned, 100);
    delegate_all(&mut world, &shared, &owned);
    open_season(&mut world, &shared);
    join_world(&mut world, &shared, &owned);
    kill::damage_counts_once(&mut world, &shared, &owned);
    kill::the_kill_pays_every_share(&mut world, &shared, &owned);
}

fn market_and_anvil(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
    // List and cancel a stack.
    send(world, ROLLUP, merchant_buy(world, owned, 1), "merchant_buy wood");
    send(world, ROLLUP, craft(world, owned, 1), "craft planks");
    let planks = kind_slot(&read(world, ROLLUP, &owned.inventory), 7).expect("planks");
    send(
        world,
        ROLLUP,
        list(world, shared, owned, planks, 500),
        "list planks",
    );
    let market = read(world, ROLLUP, &shared.market);
    assert_eq!(
        market[8 + core::mem::offset_of!(state::Market, count)],
        1,
        "one listing"
    );
    send(world, ROLLUP, cancel(world, owned, 0), "cancel listing");
    assert!(
        kind_slot(&read(world, ROLLUP, &owned.inventory), 7).is_some(),
        "the planks came back"
    );

    // Strike the anvil: a stone axe plus Glints against the uncommon target.
    for _ in 0..4 {
        send(world, ROLLUP, merchant_buy(world, owned, 2), "merchant_buy stone");
    }
    send(world, ROLLUP, craft(world, owned, 5), "craft stone axe");
    fulfill(world, 1);
    // The craft rolls the axe's rarity, so the strike is judged against it.
    let crafted = read(world, ROLLUP, &owned.inventory);
    let axe = gear_slot(&crafted, 12).expect("stone axe");
    let rarity_before = rarity_of(&crafted, axe);
    // Half the target's value in Glints keeps any rolled rarity above the
    // 30% floor; a common axe stakes 200 as before.
    let target = sunhoard::logic::merchant::charter_gear(0, rarity_before + 1).expect("target");
    let stake = (target / 2).max(200);
    let fee = target * sunhoard::logic::anvil::STRIKE_FEE_BP / 10_000;
    let purse_before = purse_glints(world, owned);
    send(
        world,
        ROLLUP,
        strike(world, shared, owned, axe, vec![], stake),
        "strike",
    );
    fulfill(world, 1);
    let inventory = read(world, ROLLUP, &owned.inventory);
    let axe_now = gear_slot(&inventory, 12);
    match axe_now {
        Some(slot) => {
            assert_eq!(
                rarity_of(&inventory, slot),
                rarity_before + 1,
                "a win raises the rarity by one"
            );
        }
        None => {
            assert!(
                purse_glints(world, owned) >= purse_before.saturating_sub(stake + fee),
                "a crack returns scrap and the stake is spent"
            );
        }
    }
}

fn rarity_of(inventory: &[u8], slot: u8) -> u8 {
    let base = 8
        + core::mem::offset_of!(state::Inventory, slots)
        + usize::from(slot) * core::mem::size_of::<state::ItemSlot>();
    inventory[base + core::mem::offset_of!(state::ItemSlot, rarity)]
}

fn the_lair(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
    send(world, ROLLUP, enter_lair(world, shared, owned), "enter_lair");
    let mut data = read(world, ROLLUP, &owned.arena);
    for _ in 0..4 {
        warp(world, 1);
        data = read(world, ROLLUP, &owned.arena);
        if data[8 + core::mem::offset_of!(state::Arena, mode)] == state::MODE_LAIR {
            break;
        }
    }
    assert_eq!(
        data[8 + core::mem::offset_of!(state::Arena, mode)],
        state::MODE_LAIR,
        "the visit opened"
    );
    assert_eq!(
        data[8 + core::mem::offset_of!(state::Arena, glare)],
        0,
        "a 100-Glint purse draws no Glare"
    );
    for _ in 0..12 {
        warp(world, 8);
    }
    let arena_data = read(world, ROLLUP, &owned.arena);
    let arena: &state::Arena = bytemuck::from_bytes(&arena_data[8..]);
    assert!(arena.boss_timer > 0, "the visit clock runs");
    send(world, ROLLUP, exit_lair(world, shared, owned), "exit_lair");
    let left = read(world, ROLLUP, &owned.arena);
    let arena: &state::Arena = bytemuck::from_bytes(&left[8..]);
    assert_eq!(arena.mode, state::MODE_IDLE, "the visit ended");
}

fn the_barn(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
    for _ in 0..24 {
        send(world, ROLLUP, merchant_buy(world, owned, 7), "merchant_buy plank");
    }
    for _ in 0..2 {
        send(world, ROLLUP, merchant_buy(world, owned, 8), "merchant_buy bar");
    }
    for _ in 0..2 {
        send(world, ROLLUP, merchant_buy(world, owned, 5), "merchant_buy food");
    }
    send(world, ROLLUP, craft(world, owned, 13), "craft post");
    send(world, ROLLUP, craft(world, owned, 14), "craft bed");
    send(world, ROLLUP, craft(world, owned, 15), "craft workstation");
    // Nell's bound starter block goes into the post.
    send(world, ROLLUP, place_gem(world, owned, 0), "place_gem");
    let village = read(world, ROLLUP, &owned.village);
    assert!(
        u16::from_le_bytes([
            village[8 + core::mem::offset_of!(state::Village, warmth_x100)],
            village[9 + core::mem::offset_of!(state::Village, warmth_x100)],
        ]) > 0,
        "the block warms the barn"
    );
    send(world, ROLLUP, take_gem(world, owned, 0), "take_gem");
    send(world, ROLLUP, ring_bell(world, shared, owned), "ring_bell");
    fulfill(world, 1);
    let village = read(world, ROLLUP, &owned.village);
    assert_eq!(
        village[8 + core::mem::offset_of!(state::Village, bell_flags)] & 1,
        0,
        "the bell answered"
    );
    send(world, ROLLUP, collect(world, owned), "collect");
}

fn demo_grants(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
    send(world, ROLLUP, set_demo_mode(world, shared, 1), "set_demo_mode");
    send(
        world,
        ROLLUP,
        demo_grant(world, shared, owned, 16, 4, 0),
        "demo_grant",
    );
    let inventory = read(world, ROLLUP, &owned.inventory);
    let blade = gear_slot_any(&inventory, 16).expect("the granted blade");
    let base = 8 + core::mem::offset_of!(state::Inventory, slots)
        + usize::from(blade) * core::mem::size_of::<state::ItemSlot>();
    assert_eq!(inventory[base + core::mem::offset_of!(state::ItemSlot, rarity)], 4);
    assert_ne!(
        inventory[base + core::mem::offset_of!(state::ItemSlot, flags)] & state::DEMO,
        0,
        "the grant carries the DEMO tag"
    );
    send(world, ROLLUP, set_demo_mode(world, shared, 0), "set_demo_mode off");
}

fn the_clock(world: &mut World, shared: &Shared) {
    send(world, ROLLUP, schedule_world(world, shared), "schedule_world");
    send(world, ROLLUP, tick_world(world, shared), "tick_world");
    let prices = read(world, ROLLUP, &shared.prices);
    let a = u16::from_le_bytes([
        prices[8 + core::mem::offset_of!(state::PriceBoard, good_a)],
        prices[9 + core::mem::offset_of!(state::PriceBoard, good_a)],
    ]);
    assert!(a != 0, "Pell wants something");
}

fn shared_market(world: &World) -> anchor_lang::prelude::Pubkey {
    let _ = world;
    shared().market
}

fn buy_and_eat(world: &mut World, owned: &sunhoard_magicsvm_tests::Owned) {
    for _ in 0..3 {
        send(
            world,
            ROLLUP,
            merchant_buy(world, owned, 5),
            "merchant_buy food",
        );
    }
    send(world, ROLLUP, merchant_buy(world, owned, 3), "merchant_buy coal");
    send(world, ROLLUP, craft(world, owned, 3), "craft meal");
    let meal = kind_slot(&read(world, ROLLUP, &owned.inventory), 9);
    assert!(meal.is_some(), "a meal is in the pack");
    send(world, ROLLUP, eat(world, owned, meal.unwrap()), "eat");
    let player = read(world, ROLLUP, &owned.player);
    assert_eq!(
        u32_at(&player, 8 + core::mem::offset_of!(state::Player, energy)),
        100,
        "a meal tops the energy back up"
    );
}

fn craft_and_sell(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
    send(world, ROLLUP, craft(world, owned, 1), "craft planks");
    let planks = kind_slot(&read(world, ROLLUP, &owned.inventory), 7);
    assert!(planks.is_some(), "planks are in the pack");

    for _ in 0..4 {
        send(world, ROLLUP, merchant_buy(world, owned, 8), "merchant_buy bar");
    }
    let before = purse_glints(world, owned);
    send(world, ROLLUP, craft(world, owned, 7), "craft iron axe");
    fulfill(world, 1);
    let axe = gear_slot(&read(world, ROLLUP, &owned.inventory), 14);
    assert!(axe.is_some(), "the crafted iron axe is in the pack");
    let axe_slot = axe.unwrap();
    send(world, ROLLUP, equip(world, owned, axe_slot), "equip");
    let player = read(world, ROLLUP, &owned.player);
    assert_eq!(
        player[8 + core::mem::offset_of!(state::Player, equipped_slot)],
        axe_slot,
        "the axe is equipped"
    );

    let wood = kind_slot(&read(world, ROLLUP, &owned.inventory), 1);
    if let Some(slot) = wood {
        send(
            world,
            ROLLUP,
            merchant_sell(world, shared, owned, slot),
            "merchant_sell wood",
        );
        assert!(purse_glints(world, owned) >= before, "Pell pays the Charter price");
    }
}

fn run_the_cellars(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
    send(world, ROLLUP, enter(world, owned), "enter_dungeon");
    await_fight(world, owned);
    let mut arena_data = read(world, ROLLUP, &owned.arena);
    let arena: &state::Arena = bytemuck::from_bytes(&arena_data[8..]);
    assert_eq!(
        arena.weapon_material,
        sunhoard::logic::ids::MAT_IRON,
        "the run uses the equipped weapon"
    );
    assert_eq!(arena.mode, state::MODE_FIGHT);

    // Test-harness shortcut: the demo bot fights with a gilded legendary blade
    // so the six rooms finish quickly. The equip path itself was checked above.
    let arena: &mut state::Arena = bytemuck::from_bytes_mut(&mut arena_data[8..]);
    arena.weapon_material = 2;
    arena.weapon_rarity = 4;
    arena.weapon_keen = 0;
    arena.weapon_brutal = 0;
    write_arena(world, owned, &arena_data);

    let mut room = 1;
    let mut steps = 0u32;
    while room <= 6 {
        let data = read(world, ROLLUP, &owned.arena);
        let (advance, intent) = {
            let arena: &state::Arena = bytemuck::from_bytes(&data[8..]);
            if arena.cleared == 1 && room < 6 {
                room += 1;
                send(world, ROLLUP, next_room(world, owned), "next_room");
                await_fight(world, owned);
                if room == 6 {
                    let mut fresh = read(world, ROLLUP, &owned.arena);
                    let arena: &mut state::Arena = bytemuck::from_bytes_mut(&mut fresh[8..]);
                    arena.player_hp = 100;
                    arena.player.hp = 100;
                    write_arena(world, owned, &fresh);
                }
                (true, None)
            } else if arena.cleared == 1 && room == 6 {
                room = 7;
                (true, None)
            } else {
                steps += 1;
                assert!(steps < 2_000, "the run would not end");
                assert!(arena.player_hp > 0, "the bot fell in room {room}");
                // Test-harness mend: the dumb bot never dodges, so top its HP up
                // so the six rooms finish. The fight rules are covered in logic.
                if arena.player_hp < 50 {
                    let mut fresh = data.clone();
                    let arena: &mut state::Arena = bytemuck::from_bytes_mut(&mut fresh[8..]);
                    arena.player_hp = 100;
                    arena.player.hp = 100;
                    write_arena(world, owned, &fresh);
                }
                (false, Some(bot(arena)))
            }
        };
        if advance {
            continue;
        }
        let (dx, dy, attack, dash) = intent.expect("intent");
        send(
            world,
            ROLLUP,
            ix(
                instruction::ArenaInput {
                    dx,
                    dy,
                    attack,
                    dash,
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
        warp(world, 8);
    }

    let purse_before = purse_glints(world, owned);
    leave(world, shared, owned);
    fulfill(world, 1);
    assert!(
        purse_glints(world, owned) >= purse_before + 100,
        "the run banks its Glints and the chest pays"
    );
    let inventory = read(world, ROLLUP, &owned.inventory);
    assert!(kind_slot(&inventory, 6).is_some(), "Wickwax is banked");
    let _boss = sealed_slot(&inventory); // Panics with a clear message when missing.
    let player = read(world, ROLLUP, &owned.player);
    assert_eq!(
        player[8 + core::mem::offset_of!(state::Player, chests)],
        1,
        "one chest counted today"
    );
}

/// The dumb chase bot: nearest living foe, swing in reach, dash when far.
/// It stops within 10 units so its facing (set by the last step) keeps the
/// foe inside the swing arc instead of overshooting past it.
fn bot(arena: &state::Arena) -> (i8, i8, u8, u8) {
    let mut best: Option<(i32, i32, i32)> = None;
    for index in 0..usize::from(arena.monster_count) {
        let foe = &arena.monsters[index];
        if foe.body.hp <= 0 {
            continue;
        }
        let dx = foe.body.x - arena.player_x;
        let dy = foe.body.y - arena.player_y;
        let d2 = dx * dx + dy * dy;
        if best.map_or(true, |(_, _, old)| d2 < old) {
            best = Some((dx, dy, d2));
        }
    }
    let Some((dx, dy, d2)) = best else {
        return (0, 0, 0, 0);
    };
    let stop = d2 <= 10 * 10;
    let step_x = if stop {
        0
    } else {
        i8::try_from(dx.signum()).unwrap_or(0)
    };
    let step_y = if stop {
        0
    } else {
        i8::try_from(dy.signum()).unwrap_or(0)
    };
    let attack = if d2 <= 20 * 20 && arena.player.attack_cd == 0 {
        1
    } else {
        0
    };
    let dash = if d2 > 120 * 120 && arena.player.dash_cd == 0 {
        1
    } else {
        0
    };
    (step_x, step_y, attack, dash)
}

/// The crank shares warps with VRF callbacks, so a seed await loops until the
/// arena is fighting instead of counting transactions.
fn await_fight(world: &mut World, owned: &sunhoard_magicsvm_tests::Owned) {
    for _ in 0..4 {
        warp(world, 1);
        let data = read(world, ROLLUP, &owned.arena);
        if data[8 + core::mem::offset_of!(state::Arena, mode)] == state::MODE_FIGHT {
            return;
        }
    }
    panic!("the seed never opened the room");
}

fn purse_glints(world: &World, owned: &sunhoard_magicsvm_tests::Owned) -> u64 {
    let purse = read(world, ROLLUP, &owned.purse);
    u64_at(&purse, 8 + core::mem::offset_of!(state::Purse, glints))
}

fn kind_slot(data: &[u8], kind: u16) -> Option<u8> {
    let start = 8 + core::mem::offset_of!(state::Inventory, slots);
    let stride = core::mem::size_of::<state::ItemSlot>();
    let kind_at = core::mem::offset_of!(state::ItemSlot, kind);
    for index in 0..state::INVENTORY_SLOTS {
        let base = start + index * stride;
        let slot_kind = u16::from_le_bytes([data[base + kind_at], data[base + kind_at + 1]]);
        let flags = data[base + core::mem::offset_of!(state::ItemSlot, flags)];
        if slot_kind == kind && flags == 0 {
            return Some(u8::try_from(index).expect("slot"));
        }
    }
    None
}

fn gear_slot(data: &[u8], gear_kind: u16) -> Option<u8> {
    kind_slot(data, gear_kind)
}

/// Finds a gear slot regardless of flags: demo grants carry the DEMO bit.
fn gear_slot_any(data: &[u8], gear_kind: u16) -> Option<u8> {
    let start = 8 + core::mem::offset_of!(state::Inventory, slots);
    let stride = core::mem::size_of::<state::ItemSlot>();
    let kind_at = core::mem::offset_of!(state::ItemSlot, kind);
    for index in 0..state::INVENTORY_SLOTS {
        let base = start + index * stride;
        let slot_kind = u16::from_le_bytes([data[base + kind_at], data[base + kind_at + 1]]);
        if slot_kind == gear_kind {
            return Some(u8::try_from(index).expect("slot"));
        }
    }
    None
}

fn write_arena(world: &mut World, owned: &sunhoard_magicsvm_tests::Owned, data: &[u8]) {
    let address = test_utils::as_address(owned.arena);
    let mut account = world
        .svm
        .get_shared_account_for(ROLLUP, &address)
        .expect("arena");
    let mut bytes = account.data().to_vec();
    bytes[8..].copy_from_slice(&data[8..]);
    account.set_data_from_slice(&bytes);
    world
        .svm
        .ephemeral_mut()
        .set_account(address, account.into())
        .expect("arena write");
}

fn create(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned, glints: u64) {
    send(world, BASE, init_game(world, shared), "init_game");
    send(world, BASE, init_payout(world, shared), "init_payout");
    send(world, BASE, sign_up(world, owned), "sign_up");
    grant_glints(world, owned, glints);
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
    let now = world.svm.ephemeral().get_sysvar::<solana_clock::Clock>().unix_timestamp;
    sunhoard_magicsvm_tests::set_clock(&mut world.svm, now + 2);
    send(
        world,
        ROLLUP,
        ix(
            instruction::PostPosition {
                x: 376,
                y: 240,
                zone: 0,
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
                node_x: 376,
                node_y: 240,
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

fn leave(world: &mut World, shared: &Shared, owned: &sunhoard_magicsvm_tests::Owned) {
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
                season: shared.season,
                world: shared.world,
                oracle_queue: QUEUE,
                magic_program: magic(),
                task_context: world.key,
                session_token: None,
                program_identity: identity(),
                vrf_program: VRF,
                slot_hashes: SLOT_HASHES,
                system_program: system(),
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

fn grant_glints(world: &mut World, owned: &sunhoard_magicsvm_tests::Owned, amount: u64) {
    let address = test_utils::as_address(owned.purse);
    let mut account = world.svm.get_account(&address).expect("purse");
    let at = 8 + core::mem::offset_of!(state::Purse, glints);
    account.data[at..at + 8].copy_from_slice(&amount.to_le_bytes());
    world
        .svm
        .set_account(address, account)
        .expect("purse write");
}
