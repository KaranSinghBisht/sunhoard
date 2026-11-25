//! Old Gloam dies to a real fight, not to `debug_kill`: the damage is counted
//! once, the killing blow is crowned, and the payout pays all three shares.

use sunhoard::logic::combat::hit_damage;
use sunhoard::logic::ids::{MAT_STONE, RARITY_COMMON};
use sunhoard::logic::numbers::{BP, CRIT_BP, PHASE_SPRING};
use sunhoard::{accounts, instruction, state};
use sunhoard_magicsvm_tests::{
    ix, lamports, read, send, try_send, u64_at, warp, write_rollup, Owned, Shared, World,
};

use super::build::{claim, enter_lair, exit_lair, settle};
use super::{bot, BASE, ROLLUP};

/// Seven other slayers, each with the keeper's own damage, no cellar clear
/// and no age. The keeper holds an eighth, which keeps it under the 40% cap.
const OTHERS: usize = 7;
/// What is left of Old Gloam when the keeper walks in for the kill.
const LAST_HP: u64 = 30;
const TWO_DAYS: i64 = 2 * 86_400;

pub fn damage_counts_once(world: &mut World, shared: &Shared, owned: &Owned) {
    enter(world, shared, owned);
    let hits = fight(world, shared, owned, 120);
    assert!(hits >= 3, "the bot landed {hits} hits");
    send(world, ROLLUP, exit_lair(world, shared, owned), "exit_lair");
    let season = season(world, shared);
    let row = row_of(&season, world);
    let each = u64::from(hit_damage(MAT_STONE, RARITY_COMMON).expect("stone"));
    let crit = each * u64::from(CRIT_BP) / u64::from(BP);
    assert!(
        row.damage >= hits * each && row.damage <= hits * crit,
        "{hits} hits of {each} to {crit} were counted as {}",
        row.damage
    );
    assert_eq!(season.total_damage, row.damage, "the total matches the row");
    let (hp, max_hp) = gloam(world, shared);
    assert_eq!(max_hp - hp, row.damage, "the pool lost what the row gained");
    assert_eq!(row.flags, 0, "no cellar clear and no kill yet");
}

pub fn the_kill_pays_every_share(world: &mut World, shared: &Shared, owned: &Owned) {
    let mine = row_of(&season(world, shared), world).damage + LAST_HP;
    add_other_slayers(world, shared, mine);
    // The keeper has cleared the cellars and signed up two days ago.
    write_rollup(world, &owned.player, |data| {
        let clears = core::mem::offset_of!(state::Player, first_clears);
        data[clears..clears + 4].copy_from_slice(&1u32.to_le_bytes());
        let born = core::mem::offset_of!(state::Player, born_at);
        let then = i64::from_le_bytes(data[born..born + 8].try_into().expect("born_at")) - TWO_DAYS;
        data[born..born + 8].copy_from_slice(&then.to_le_bytes());
    });
    write_rollup(world, &shared.world, |data| {
        let hp = core::mem::offset_of!(state::World, hp);
        data[hp..hp + 8].copy_from_slice(&LAST_HP.to_le_bytes());
    });

    enter(world, shared, owned);
    fight(world, shared, owned, 200);
    assert_eq!(gloam(world, shared).0, 0, "Old Gloam fell");
    let arena_data = read(world, ROLLUP, &owned.arena);
    let arena: &state::Arena = bytemuck::from_bytes(&arena_data[8..]);
    assert_eq!(arena.mode, state::MODE_IDLE, "the kill ends the visit");

    let after = season(world, shared);
    let row = row_of(&after, world);
    assert_eq!(row.damage, mine, "damage past the last HP is not counted");
    assert_eq!(row.flags, state::CLEARED_T1 | state::IS_KILLER);
    assert!(row.age_secs >= TWO_DAYS as u64, "the row carries the wallet's age");
    assert_eq!(after.killer, world.key);
    assert_eq!(after.ember_holder, world.key, "the Ember Egg goes with the kill");
    assert_ne!(after.flags & state::HAS_KILLER, 0);
    assert_eq!(after.phase, PHASE_SPRING, "the kill opens Spring");

    assert!(
        !try_send(
            world,
            ROLLUP,
            ix(
                instruction::NameWyrm {
                    name: "bad lowercase".to_string(),
                },
                accounts::NameWyrm {
                    payer: world.key,
                    player: owned.player,
                    season: shared.season,
                    session_token: None,
                },
            ),
        ),
        "lowercase wyrm names are rejected"
    );
    send(
        world,
        ROLLUP,
        ix(
            instruction::NameWyrm {
                name: "SOLARIS".to_string(),
            },
            accounts::NameWyrm {
                payer: world.key,
                player: owned.player,
                season: shared.season,
                session_token: None,
            },
        ),
        "name_wyrm",
    );
    let named = season(world, shared);
    assert_eq!(&named.wyrm_name[..7], b"SOLARIS");
    assert_eq!(named.flags & state::HAS_EMBER, 0);

    assert!(
        !try_send(world, ROLLUP, enter_lair(world, shared, owned)),
        "nobody enters the Crater after the kill"
    );
    // The visit ended by itself; leaving still stops its crank.
    send(world, ROLLUP, exit_lair(world, shared, owned), "exit_lair after the kill");
    paid_in_full(world, shared);
}

fn paid_in_full(world: &mut World, shared: &Shared) {
    send(world, ROLLUP, settle(world, shared), "settle_season");
    let data = read(world, BASE, &shared.payout);
    let payout: &state::Payout = bytemuck::from_bytes(&data[8..]);
    assert_eq!(payout.season_number, 1);
    // An eighth of the 70% by damage, the whole 20% equal share (nobody else
    // qualifies) and the killer's 10%: 38.75%, under the 40% cap.
    let shares = 1 + OTHERS as u64;
    let expected = payout.pot * 70 / 100 / shares + payout.pot * 20 / 100 + payout.pot / 10;
    assert!(expected < payout.pot * 40 / 100, "the test stays under the cap");
    let row = payout
        .rows
        .iter()
        .take(usize::from(payout.len))
        .find(|row| row.wallet == world.key)
        .expect("the killer's payout row");
    assert!(
        row.amount.abs_diff(expected) < 1_000,
        "the killer is owed {expected} and was written {}",
        row.amount
    );
    let owed = row.amount;
    let wallet = test_utils::as_address(world.key);
    let start = lamports(world, &wallet);
    send(world, BASE, claim(world, shared), "claim");
    let gained = lamports(world, &wallet) - start;
    assert!(
        gained + 20_000 >= owed && gained <= owed,
        "the claim paid {gained} of {owed}"
    );
    assert!(!try_send(world, BASE, claim(world, shared)), "a second claim");
}

fn add_other_slayers(world: &mut World, shared: &Shared, damage: u64) {
    let wallets: Vec<_> = (0..OTHERS)
        .map(|_| anchor_lang::prelude::Pubkey::new_unique())
        .collect();
    send(
        world,
        ROLLUP,
        ix(
            instruction::DebugKill {
                wallet: wallets,
                damage: vec![damage; OTHERS],
                age_secs: vec![0; OTHERS],
                flags: vec![0; OTHERS],
                finish: 0,
            },
            accounts::DebugKill {
                admin: world.key,
                season: shared.season,
                world: shared.world,
            },
        ),
        "debug rows for the other slayers",
    );
}

fn enter(world: &mut World, shared: &Shared, owned: &Owned) {
    send(world, ROLLUP, enter_lair(world, shared, owned), "enter_lair");
    for _ in 0..4 {
        warp(world, 1);
        let data = read(world, ROLLUP, &owned.arena);
        if data[8 + core::mem::offset_of!(state::Arena, mode)] == state::MODE_LAIR {
            return;
        }
    }
    panic!("the visit never opened");
}

/// Chases the coil and swings until the visit ends or `steps` run out.
/// Returns the hits landed.
fn fight(world: &mut World, shared: &Shared, owned: &Owned, steps: u32) -> u64 {
    let mut hits = 0;
    for _ in 0..steps {
        let data = read(world, ROLLUP, &owned.arena);
        let arena: &state::Arena = bytemuck::from_bytes(&data[8..]);
        if arena.mode != state::MODE_LAIR {
            break;
        }
        hits = u64::from(arena.lair_hits);
        if arena.player_hp < 50 {
            // The dumb bot never dodges; the harness keeps it standing.
            write_rollup(world, &owned.arena, |bytes| {
                let arena: &mut state::Arena = bytemuck::from_bytes_mut(bytes);
                arena.player_hp = 100;
                arena.player.hp = 100;
            });
        }
        let (dx, dy, attack, dash) = bot(arena);
        send(
            world,
            ROLLUP,
            ix(
                instruction::LairInput {
                    dx,
                    dy,
                    attack,
                    dash,
                },
                accounts::LairInput {
                    payer: world.key,
                    player: owned.player,
                    arena: owned.arena,
                    session_token: None,
                },
            ),
            "lair_input",
        );
        warp(world, 8);
    }
    let _ = shared;
    hits
}

fn season(world: &World, shared: &Shared) -> state::Season {
    let data = read(world, ROLLUP, &shared.season);
    *bytemuck::from_bytes::<state::Season>(&data[8..])
}

fn row_of(season: &state::Season, world: &World) -> state::DamageSlot {
    *season
        .damage
        .iter()
        .take(usize::from(season.damage_len))
        .find(|row| row.wallet == world.key)
        .expect("the keeper's damage row")
}

/// Old Gloam's HP and max HP. The harness reads World; no player can.
fn gloam(world: &World, shared: &Shared) -> (u64, u64) {
    let data = read(world, ROLLUP, &shared.world);
    (
        u64_at(&data, 8 + core::mem::offset_of!(state::World, hp)),
        u64_at(&data, 8 + core::mem::offset_of!(state::World, max_hp)),
    )
}
