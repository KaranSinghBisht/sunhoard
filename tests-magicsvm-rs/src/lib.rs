//! Helpers for the in-process MagicSVM tests. The deploy binary stays debug-free.

use anchor_lang::prelude::{system_program, Id, Pubkey};
use anchor_lang::{InstructionData, ToAccountMetas};
use ephemeral_rollups_sdk::anchor::{DelegationProgram, MagicProgram};
use ephemeral_rollups_sdk::consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID};
use ephemeral_rollups_sdk::pda::{
    delegate_buffer_pda_from_delegated_account_and_owner_program,
    delegation_metadata_pda_from_delegated_account, delegation_record_pda_from_delegated_account,
    ephemeral_balance_pda_from_payer,
};
use magicblock_account::ReadableAccount;
use magicsvm::{MagicSVM, TransactionTarget};
use solana_address::{address, Address};
use solana_clock::Clock;
use solana_instruction::Instruction;
use solana_keypair::Keypair;
use solana_native_token::LAMPORTS_PER_SOL;
use solana_signer::Signer;
use sunhoard::state::{
    ARENA_SEED, FIRST_SEASON_SEED, INVENTORY_SEED, MARKET_SEED, PAYOUT_SEED, PLAYER_SEED,
    PRESENCE_SEED, PRICES_SEED, PURSE_SEED, SEASON_SEED, VAULT_SEED, VIEW_SEED, VILLAGE_SEED,
    WORLD_SEED,
};
use test_utils::{add_program, airdrop, as_address, as_pubkey, send_ixs};

pub const QUEUE: Pubkey = Pubkey::from_str_const("5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc");
pub const VRF: Pubkey = Pubkey::from_str_const("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");
pub const SLOT_HASHES: Pubkey =
    Pubkey::from_str_const("SysvarS1otHashes111111111111111111111111111");
const CLOCK_UNIX: i64 = 1_700_000_000;

pub struct World {
    pub svm: MagicSVM,
    pub payer: Keypair,
    pub key: Pubkey,
}

pub fn boot() -> World {
    boot_with("sbf-debug")
}

pub fn boot_release() -> World {
    boot_with("deploy")
}

fn boot_with(directory: &str) -> World {
    let payer = Keypair::new();
    let mut svm = MagicSVM::new();
    let so = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../target").join(directory).join("sunhoard.so");
    add_program(&mut svm, as_address(sunhoard::ID), &so);
    airdrop(&mut svm, &payer.pubkey(), 40 * LAMPORTS_PER_SOL);
    set_clock(&mut svm, CLOCK_UNIX);
    World {
        svm,
        key: as_pubkey(&payer.pubkey()),
        payer,
    }
}

pub fn send(world: &mut World, target: TransactionTarget, ix: Instruction, label: &str) {
    send_ixs(
        &mut world.svm,
        target,
        &[&world.payer],
        &[compute_budget(1_400_000), ix],
        label,
    );
}

/// Sends a transaction that is allowed to fail, and says whether it landed.
pub fn try_send(world: &mut World, target: TransactionTarget, ix: Instruction) -> bool {
    let tx = test_utils::sign_tx(
        &[&world.payer],
        &[compute_budget(1_400_000), ix],
        world.svm.latest_blockhash_for(target),
    );
    let landed = world.svm.send_transaction_to(target, tx).is_ok();
    world.svm.expire_blockhash_for(target);
    landed
}

/// Overwrites a rollup account's data past its discriminator. The harness
/// uses it to set up a state that would take a long honest run to reach.
pub fn write_rollup(world: &mut World, account: &Pubkey, edit: impl FnOnce(&mut [u8])) {
    let address = as_address(*account);
    let mut shared = world
        .svm
        .get_shared_account_for(TransactionTarget::Ephemeral, &address)
        .unwrap_or_else(|| panic!("missing {account} on the rollup"));
    let mut bytes = shared.data().to_vec();
    edit(&mut bytes[8..]);
    shared.set_data_from_slice(&bytes);
    world
        .svm
        .ephemeral_mut()
        .set_account(address, shared.into())
        .unwrap_or_else(|err| panic!("write {account}: {err:?}"));
}

fn compute_budget(units: u32) -> Instruction {
    let mut data = vec![2u8];
    data.extend_from_slice(&units.to_le_bytes());
    Instruction {
        program_id: address!("ComputeBudget111111111111111111111111111111"),
        accounts: vec![],
        data,
    }
}

pub fn fulfill(world: &mut World, expected: usize) {
    let slot = world.svm.get_sysvar::<Clock>().slot;
    let results = world.svm.warp_to_slot(slot + 1);
    assert_eq!(results.len(), expected, "callback count");
    for result in results {
        if let Err(failed) = result {
            panic!(
                "callback failed: {:?}\nlogs: {:#?}",
                failed.err, failed.meta.logs
            );
        }
    }
}

pub fn warp(world: &mut World, slots: u64) -> usize {
    let slot = world.svm.ephemeral().get_sysvar::<Clock>().slot;
    let results = world.svm.warp_to_slot(slot + slots);
    for result in &results {
        if let Err(failed) = result {
            panic!(
                "crank failed: {:?}\nlogs: {:#?}",
                failed.err, failed.meta.logs
            );
        }
    }
    results.len()
}

pub fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &sunhoard::ID).0
}

pub fn shared() -> Shared {
    Shared {
        season: pda(&[SEASON_SEED]),
        world: pda(&[WORLD_SEED]),
        market: pda(&[MARKET_SEED]),
        prices: pda(&[PRICES_SEED]),
        presence: pda(&[PRESENCE_SEED]),
        vault: pda(&[VAULT_SEED]),
        payout: pda(&[PAYOUT_SEED, &FIRST_SEASON_SEED]),
    }
}

pub fn owned(owner: &Pubkey) -> Owned {
    Owned {
        player: pda(&[PLAYER_SEED, owner.as_ref()]),
        purse: pda(&[PURSE_SEED, owner.as_ref()]),
        inventory: pda(&[INVENTORY_SEED, owner.as_ref()]),
        village: pda(&[VILLAGE_SEED, owner.as_ref()]),
        arena: pda(&[ARENA_SEED, owner.as_ref()]),
        view: pda(&[VIEW_SEED, owner.as_ref()]),
    }
}

pub struct Shared {
    pub season: Pubkey,
    pub world: Pubkey,
    pub market: Pubkey,
    pub prices: Pubkey,
    pub presence: Pubkey,
    pub vault: Pubkey,
    pub payout: Pubkey,
}

pub struct Owned {
    pub player: Pubkey,
    pub purse: Pubkey,
    pub inventory: Pubkey,
    pub village: Pubkey,
    pub arena: Pubkey,
    pub view: Pubkey,
}

pub struct Delegated {
    pub buffer: Pubkey,
    pub record: Pubkey,
    pub metadata: Pubkey,
}

pub fn delegated(account: &Pubkey) -> Delegated {
    Delegated {
        buffer: delegate_buffer_pda_from_delegated_account_and_owner_program(
            account,
            &sunhoard::ID,
        ),
        record: delegation_record_pda_from_delegated_account(account),
        metadata: delegation_metadata_pda_from_delegated_account(account),
    }
}

pub fn permission(account: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[
            ephemeral_rollups_sdk::access_control::structs::PERMISSION_SEED,
            account.as_ref(),
        ],
        &PERMISSION_PROGRAM_ID,
    )
    .0
}

pub fn identity() -> Pubkey {
    Pubkey::find_program_address(&[b"identity"], &sunhoard::ID).0
}

pub fn escrow(payer: &Pubkey) -> Pubkey {
    ephemeral_balance_pda_from_payer(payer, 255)
}

pub fn ix(data: impl InstructionData, accounts: impl ToAccountMetas) -> Instruction {
    test_utils::client_ix(as_address(sunhoard::ID), data, accounts)
}

pub fn read(world: &World, target: TransactionTarget, account: &Pubkey) -> Vec<u8> {
    world
        .svm
        .get_shared_account_for(target, &as_address(*account))
        .unwrap_or_else(|| panic!("missing {account} on {target:?}"))
        .data()
        .to_vec()
}

pub fn u64_at(data: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(data[offset..offset + 8].try_into().expect("u64"))
}

pub fn i64_at(data: &[u8], offset: usize) -> i64 {
    i64::from_le_bytes(data[offset..offset + 8].try_into().expect("i64"))
}

pub fn u32_at(data: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(data[offset..offset + 4].try_into().expect("u32"))
}

pub fn validator(world: &World) -> Pubkey {
    as_pubkey(&world.svm.validator_identity())
}

pub fn magic() -> Pubkey {
    let id = MagicProgram::id();
    assert_eq!(id.to_bytes(), MAGIC_PROGRAM_ID.to_bytes());
    id
}

pub fn delegation() -> Pubkey {
    DelegationProgram::id()
}

pub fn permission_program() -> Pubkey {
    PERMISSION_PROGRAM_ID
}

pub fn ephemeral_vault() -> Pubkey {
    EPHEMERAL_VAULT_ID
}

pub fn system() -> Pubkey {
    system_program::ID
}

pub fn set_clock(svm: &mut MagicSVM, unix: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp = unix;
    svm.set_sysvar(&clock);
    svm.ephemeral_mut().set_sysvar(&clock);
}

pub fn lamports(world: &World, account: &Address) -> u64 {
    world.svm.get_balance(account).unwrap_or(0)
}
