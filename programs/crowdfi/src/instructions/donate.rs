use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_lang::system_program;

use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct Donate<'info> {
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
        init_if_needed,
        payer = donor,
        space = 8 + Donation::INIT_SPACE,
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

fn checked_add_u64(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs).ok_or(CustomError::Overflow.into())
}

pub fn handler(ctx: Context<Donate>, _campaign_id: u64, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let campaign = &mut ctx.accounts.campaign;

    require!(amount > 0, CustomError::InvalidAmount);
    require!(!campaign.withdrawn, CustomError::CampaignAlreadyWithdrawn);
    require!(now <= campaign.end_time, CustomError::CampaignEnded);
    require!(campaign.raised < campaign.goal, CustomError::GoalAlreadyReached);

    let donor_ai = ctx.accounts.donor.to_account_info();
    let vault_ai = ctx.accounts.vault.to_account_info();
    let system_program_ai = ctx.accounts.system_program.to_account_info();

    invoke(
        &system_instruction::transfer(&ctx.accounts.donor.key(), &ctx.accounts.vault.key(), amount),
        &[donor_ai, vault_ai, system_program_ai],
    )?;

    campaign.raised = checked_add_u64(campaign.raised, amount)?;

    let donation = &mut ctx.accounts.donation;
    if donation.amount == 0 {
        donation.campaign = campaign.key();
        donation.donor = ctx.accounts.donor.key();
    }

    require!(donation.campaign == campaign.key(), CustomError::InvalidDonationAccount);
    require!(donation.donor == ctx.accounts.donor.key(), CustomError::InvalidDonationAccount);

    donation.amount = checked_add_u64(donation.amount, amount)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checked_add_overflow_fails() {
        let res = checked_add_u64(u64::MAX, 1);
        assert!(res.is_err());
    }

    #[test]
    fn checked_add_normal_passes() {
        let res = checked_add_u64(10, 5);
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), 15);
    }
}
