use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct CreateCampaign<'info> {

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [
            b"campaign",
            signer.key().as_ref(),
            campaign_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        init,
        payer = signer,
        space = 0,
        seeds = [
            b"vault",
            campaign.key().as_ref()
        ],
        bump,
        owner = system_program::ID
    )]
    /// CHECK: This PDA is a system-owned lamports vault with zero data.
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateCampaign>,
    campaign_id: u64,
    title: String,
    goal: u64,
    end_time: i64,
) -> Result<()> {

    let campaign = &mut ctx.accounts.campaign;
    let signer = &ctx.accounts.signer;
    let now = Clock::get()?.unix_timestamp;
    let duration = end_time
        .checked_sub(now)
        .ok_or(CustomError::InvalidEndTime)?;
    const MIN_DURATION: i64 = 5; // 5 seconds
    const MAX_DURATION: i64 = 365 * 24 * 60 * 60; // 365 days

    require!(goal > 0, CustomError::InvalidGoal);
    require!(title.len() > 0 && title.len() <= 25, CustomError::InvalidTitle);
    require!(end_time > now, CustomError::InvalidEndTime);
    require!(duration >= MIN_DURATION, CustomError::DurationTooShort);
    require!(duration <= MAX_DURATION, CustomError::DurationTooLong);

    campaign.owner = signer.key();
    campaign.title = title;
    campaign.goal = goal;
    campaign.raised = 0;
    campaign.end_time = end_time;
    campaign.withdrawn = false;
    campaign.bump = ctx.bumps.campaign;
    campaign.campaign_id=campaign_id;
    msg!("{:?} Campaign",campaign);
    Ok(())
}
