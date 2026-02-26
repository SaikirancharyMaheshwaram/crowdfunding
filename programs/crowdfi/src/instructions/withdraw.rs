use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use anchor_lang::system_program;

use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner @ CustomError::Unauthorized,
        seeds = [
            b"campaign",
            owner.key().as_ref(),
            campaign_id.to_le_bytes().as_ref()
        ],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        mut,
        seeds = [b"vault", campaign.key().as_ref()],
        bump,
        owner = system_program::ID
    )]
    /// CHECK: System-owned PDA used only as SOL vault.
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Withdraw>, _campaign_id: u64) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;

    require!(campaign.raised >= campaign.goal, CustomError::CampaignNotSuccessful);
    require!(!campaign.withdrawn, CustomError::CampaignAlreadyWithdrawn);

    let amount = **ctx.accounts.vault.lamports.borrow();
    require!(amount > 0, CustomError::NothingToWithdraw);

    let campaign_key = campaign.key();
    let vault_bump = ctx.bumps.vault;
    let signer_seeds: &[&[u8]] = &[b"vault", campaign_key.as_ref(), &[vault_bump]];

    let vault_ai = ctx.accounts.vault.to_account_info();
    let owner_ai = ctx.accounts.owner.to_account_info();
    let system_program_ai = ctx.accounts.system_program.to_account_info();

    invoke_signed(
        &system_instruction::transfer(&ctx.accounts.vault.key(), &ctx.accounts.owner.key(), amount),
        &[vault_ai, owner_ai, system_program_ai],
        &[signer_seeds],
    )?;

    campaign.withdrawn = true;

    Ok(())
}
