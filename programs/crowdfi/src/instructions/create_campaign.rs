use anchor_lang::prelude::*;

use crate::{error::CustomError, state::Campaign};

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
          bump
      )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_campaign(
    ctx: Context<CreateCampaign>,
    campaign_id: u64,
    title: String,
    goal: u64,
    end_time: i64,
) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;
    let signer = &ctx.accounts.signer;

    // Get current blockchain time once
    let now = Clock::get()?.unix_timestamp;
    const MIN_DURATION: i64 = 3600; // 1 hour
    const MAX_DURATION: i64 = 365 * 24 * 3600; // 1 year

    // -------- VALIDATIONS --------
    require!(goal > 0, CustomError::InvalidGoal);
    require!(
        title.len() > 0 && title.len() <= 25,
        CustomError::InvalidTitle
    );

    require!(
        end_time - now >= MIN_DURATION,
        CustomError::DurationTooShort
    );
    require!(end_time > now, CustomError::InvalidEndTime);

    // -------- STATE INITIALIZATION --------
    campaign.owner = signer.key();
    campaign.title = title;
    campaign.goal = goal;
    campaign.raised = 0;
    campaign.end_time = end_time;
    campaign.withdrawn = false;
    campaign.bump = ctx.bumps.campaign;

    Ok(())
}


#[derive(Accounts)]
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
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    // 3️⃣ Vault (will receive SOL)
    #[account(
        mut,
        seeds = [
            b"vault",
            campaign.key().as_ref()
        ],
        bump
    )]
    pub vault: SystemAccount<'info>,

    // 4️⃣ Donation PDA (tracks donor amount)
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

    // 5️⃣ Required for transfers
    pub system_program: Program<'info, System>,
}