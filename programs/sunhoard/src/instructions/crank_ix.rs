//! The same schedule and cancel instructions `ScheduleCrankCpi` builds.
//! The CPI struct ties every borrow to the account lifetime, which these locals cannot satisfy.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use magicblock_magic_program_api::args::ScheduleTaskArgs;
use magicblock_magic_program_api::instruction::MagicBlockInstruction;

pub(crate) fn schedule<'info>(
    payer: AccountInfo<'info>,
    magic_program: AccountInfo<'info>,
    used: &[AccountInfo<'info>],
    args: ScheduleTaskArgs,
) -> Result<()> {
    let mut metas = Vec::with_capacity(1 + used.len());
    metas.push(AccountMeta::new(*payer.key, true));
    for account in used {
        metas.push(AccountMeta {
            pubkey: *account.key,
            is_signer: account.is_signer,
            is_writable: account.is_writable,
        });
    }
    let ix = Instruction::new_with_bincode(
        *magic_program.key,
        &MagicBlockInstruction::ScheduleTask(args),
        metas,
    );
    let mut infos = Vec::with_capacity(1 + used.len());
    infos.push(payer);
    infos.extend_from_slice(used);
    invoke(&ix, &infos)?;
    Ok(())
}

pub(crate) fn cancel<'info>(
    authority: AccountInfo<'info>,
    task_context: AccountInfo<'info>,
    magic_program: AccountInfo<'info>,
    task_id: i64,
) -> Result<()> {
    let authority_meta = if authority.is_writable {
        AccountMeta::new(*authority.key, true)
    } else {
        AccountMeta::new_readonly(*authority.key, true)
    };
    let ix = Instruction::new_with_bincode(
        *magic_program.key,
        &MagicBlockInstruction::CancelTask { task_id },
        vec![authority_meta, AccountMeta::new(*task_context.key, false)],
    );
    invoke(&ix, &[authority, task_context])?;
    Ok(())
}
