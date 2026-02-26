use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use anchor_lang::system_program;

use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct Refund<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(
        mut,
        seeds = [
            b"campaign",
            campaign.owner.as_ref(),
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

    #[account(
        mut,
        seeds = [
            b"donation",
            campaign.key().as_ref(),
            donor.key().as_ref()
        ],
        bump
    )]
    pub donation: Account<'info, Donation>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Refund>, _campaign_id: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &ctx.accounts.campaign;
    let donation = &mut ctx.accounts.donation;

    require!(campaign.raised < campaign.goal, CustomError::GoalAlreadyReached);
    require!(now > campaign.end_time, CustomError::CampaignStillActive);
    require!(!campaign.withdrawn, CustomError::CampaignAlreadyWithdrawn);

    require!(donation.campaign == campaign.key(), CustomError::InvalidDonationAccount);
    require!(donation.donor == ctx.accounts.donor.key(), CustomError::InvalidDonationAccount);
    require!(donation.amount > 0, CustomError::NothingToRefund);

    let amount = donation.amount;

    let campaign_key = campaign.key();
    let vault_bump = ctx.bumps.vault;
    let signer_seeds: &[&[u8]] = &[b"vault", campaign_key.as_ref(), &[vault_bump]];

    let vault_ai = ctx.accounts.vault.to_account_info();
    let donor_ai = ctx.accounts.donor.to_account_info();
    let system_program_ai = ctx.accounts.system_program.to_account_info();

    invoke_signed(
        &system_instruction::transfer(&ctx.accounts.vault.key(), &ctx.accounts.donor.key(), amount),
        &[vault_ai, donor_ai, system_program_ai],
        &[signer_seeds],
    )?;

    donation.amount = 0;

    Ok(())
}
