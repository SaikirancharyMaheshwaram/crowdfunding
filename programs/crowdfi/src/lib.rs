use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;
use instructions::*;

declare_id!("FYoDEPSb4Xf5oVqKcqpE8myQjsm1873bPd4k6fE5oD6L");

#[program]
pub mod crowdfi {
    use super::*;

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id: u64,
        title: String,
        goal: u64,
        end_time: i64,
    ) -> Result<()> {
        instructions::create_campaign::handler(ctx, campaign_id, title, goal, end_time)
    }

    pub fn donate(ctx: Context<Donate>, campaign_id: u64, amount: u64) -> Result<()> {
        instructions::donate::handler(ctx, campaign_id, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, campaign_id: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, campaign_id)
    }

    pub fn refund(ctx: Context<Refund>, campaign_id: u64) -> Result<()> {
        instructions::refund::handler(ctx, campaign_id)
    }
}
